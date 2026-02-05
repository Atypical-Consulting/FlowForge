# Phase 12: Workflows - Research

**Researched:** 2026-02-05
**Domain:** Git workflows (clone, gitflow init, amend commit)
**Confidence:** HIGH

## Summary

Phase 12 implements three distinct workflows: Clone Repository (with progress tracking), Initialize Gitflow (on non-Gitflow repos), and Amend Commit (with message pre-fill). Research confirms the existing codebase provides strong foundations:

1. **Clone**: Uses git2's `RepoBuilder` with progress callbacks via `RemoteCallbacks::transfer_progress()` and `CheckoutBuilder::progress()`. The existing progress channel pattern from `SyncProgress` can be extended.

2. **Gitflow Init**: The existing `GitflowContext` already detects `has_main` and `has_develop`. A new command creates the develop branch and stores branch name configuration in `.git/config`.

3. **Amend**: The backend already supports `amend: bool` in `create_commit()`. Frontend needs a new `getLastCommitMessage()` command for pre-fill, plus confirmation dialog logic.

**Primary recommendation:** Leverage existing patterns - extend `SyncProgress` for clone, add `initGitflow` command parallel to existing gitflow commands, add `getLastCommitMessage` command for amend pre-fill.

## Standard Stack

The codebase already uses the correct tools. No new dependencies required.

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| git2 | 0.20 | All Git operations | libgit2 bindings, production-proven |
| tauri | 2.x | IPC, file dialogs, channels | Native desktop runtime |
| tauri-plugin-dialog | 2.x | Folder picker for clone destination | Official Tauri plugin |
| tauri-specta | 2.0.0-rc.21 | TypeScript bindings generation | Type-safe IPC |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | existing | Data fetching, mutations | All API calls |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts | Amend toggle shortcut |
| zustand | existing | State management | Clone progress state |

### No New Dependencies Needed

The clone operation uses git2's built-in `RepoBuilder` - no external clone library needed.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
├── git/
│   ├── clone.rs        # NEW: Clone with progress callbacks
│   └── commit.rs       # MODIFY: Add get_last_commit_message
├── gitflow/
│   ├── commands.rs     # MODIFY: Add init_gitflow command
│   └── config.rs       # NEW: Gitflow branch name configuration
└── lib.rs              # MODIFY: Register new commands

src/
├── components/
│   ├── clone/
│   │   ├── CloneForm.tsx     # NEW: URL input + folder picker
│   │   └── CloneProgress.tsx # NEW: Progress display component
│   ├── gitflow/
│   │   └── InitGitflowDialog.tsx # NEW: Branch configuration modal
│   └── commit/
│       ├── CommitForm.tsx        # MODIFY: Add amend pre-fill
│       └── AmendConfirmDialog.tsx # NEW: Confirmation before amend
└── stores/
    └── clone.ts        # NEW: Clone progress state
```

### Pattern 1: Clone with Progress Callbacks (git2)
**What:** Use `RepoBuilder` with `FetchOptions` containing `RemoteCallbacks` for transfer progress, and `CheckoutBuilder` for checkout progress.
**When to use:** Any clone operation that needs progress feedback.
**Example:**
```rust
// Source: https://docs.rs/git2/latest/git2/build/struct.RepoBuilder.html
use git2::{build::RepoBuilder, FetchOptions, RemoteCallbacks};
use tauri::ipc::Channel;

pub async fn clone_repository(
    url: String,
    destination: String,
    on_progress: Channel<CloneProgress>,
) -> Result<String, GitError> {
    let progress_channel = on_progress.clone();
    
    tokio::task::spawn_blocking(move || {
        let mut callbacks = RemoteCallbacks::new();
        
        // Transfer progress (receiving objects)
        let progress_transfer = progress_channel.clone();
        callbacks.transfer_progress(move |stats| {
            let _ = progress_transfer.send(CloneProgress::Receiving {
                current: stats.received_objects() as u32,
                total: stats.total_objects() as u32,
                bytes: stats.received_bytes() as u32,
            });
            true // Return false to cancel
        });
        
        // Credentials (reuse existing pattern)
        callbacks.credentials(create_credentials_callback());
        
        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);
        
        // Checkout progress
        let progress_checkout = on_progress.clone();
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.progress(move |_path, current, total| {
            let _ = progress_checkout.send(CloneProgress::CheckingOut {
                current: current as u32,
                total: total as u32,
            });
        });
        
        let repo = RepoBuilder::new()
            .fetch_options(fetch_options)
            .with_checkout(checkout)
            .clone(&url, Path::new(&destination))?;
        
        Ok(repo.path().parent().unwrap().to_string_lossy().to_string())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Pattern 2: Gitflow Init Command
**What:** Create develop branch from main, store branch name configuration.
**When to use:** When repository has main but no develop branch.
**Example:**
```rust
// Source: Existing gitflow/commands.rs pattern
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitflowConfig {
    pub main_branch: String,
    pub develop_branch: String,
    pub feature_prefix: String,
    pub release_prefix: String,
    pub hotfix_prefix: String,
}

#[tauri::command]
#[specta::specta]
pub async fn init_gitflow(
    config: GitflowConfig,
    push_develop: bool,
    state: State<'_, RepositoryState>,
) -> Result<(), GitflowError> {
    let repo_path = get_repo_path(&state).await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&repo_path)?;
        
        // Check if develop already exists
        let develop_exists = repo.find_branch(&config.develop_branch, BranchType::Local).is_ok();
        
        if !develop_exists {
            // Create develop from main
            let main_branch = repo.find_branch(&config.main_branch, BranchType::Local)?;
            let main_commit = main_branch.get().peel_to_commit()?;
            repo.branch(&config.develop_branch, &main_commit, false)?;
        }
        
        // Store config in .git/config (gitflow standard)
        let mut git_config = repo.config()?;
        git_config.set_str("gitflow.branch.main", &config.main_branch)?;
        git_config.set_str("gitflow.branch.develop", &config.develop_branch)?;
        git_config.set_str("gitflow.prefix.feature", &config.feature_prefix)?;
        git_config.set_str("gitflow.prefix.release", &config.release_prefix)?;
        git_config.set_str("gitflow.prefix.hotfix", &config.hot_prefix)?;
        
        // Checkout develop
        repo.set_head(&format!("refs/heads/{}", config.develop_branch))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))?;
        
        Ok(())
    })
    .await
    .map_err(|e| GitflowError::Internal(format!("Task join error: {}", e)))?
}
```

### Pattern 3: Get Last Commit Message for Amend
**What:** Retrieve HEAD commit's full message for pre-fill.
**When to use:** When user toggles amend checkbox.
**Example:**
```rust
// Source: Existing git/history.rs pattern
#[tauri::command]
#[specta::specta]
pub async fn get_last_commit_message(
    state: State<'_, RepositoryState>,
) -> Result<Option<String>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;
    
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&repo_path)?;
        
        match repo.head() {
            Ok(head) => {
                let commit = head.peel_to_commit()?;
                Ok(Some(commit.message().unwrap_or("").to_string()))
            }
            Err(_) => Ok(None), // No HEAD commit
        }
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Anti-Patterns to Avoid
- **Spawning git CLI for clone:** The codebase uses git2 throughout. Don't break consistency by shelling out to `git clone`.
- **Polling for progress:** Use Tauri Channels (like existing fetch/push/pull). Don't poll from frontend.
- **Blocking UI during clone:** Always use `tokio::task::spawn_blocking` for git2 operations.
- **Storing gitflow config in app settings:** Use `.git/config` to be compatible with git-flow CLI tools.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clone progress | Custom progress tracking | git2 `transfer_progress` + `checkout.progress` | Already handles receiving, resolving, checkout phases |
| Folder picker | Custom file browser | `tauri-plugin-dialog` `open({ directory: true })` | Already in project, native OS dialogs |
| Git ref validation | Custom regex | git2's `Reference::is_valid_name()` | Handles all edge cases |
| Credentials | Prompt user | git2's credential callback chain | SSH agent, credential helpers |
| Branch detection | Parse branch names | Existing `GitflowContext::from_repo()` | Already handles main/master, develop/development |

**Key insight:** The git2 crate handles virtually all Git complexity. Clone is just `RepoBuilder::clone()` with callbacks.

## Common Pitfalls

### Pitfall 1: Clone Destination Path Handling
**What goes wrong:** Path separator issues on Windows, paths with spaces, non-existent parent directories.
**Why it happens:** Cross-platform path handling differences.
**How to avoid:** 
- Use `std::path::PathBuf` consistently
- Create parent directories with `std::fs::create_dir_all()`
- Let Tauri dialog return normalized paths
**Warning signs:** Clone works on Mac/Linux but fails on Windows.

### Pitfall 2: Clone Progress Callback Thread Safety
**What goes wrong:** `RefCell` panics or send errors on progress channel.
**Why it happens:** git2 callbacks may be called from different threads.
**How to avoid:**
- Use `Channel<T>` which is Send + Sync
- Don't use `RefCell` - it's not thread-safe
- Use atomic types or mutex if state sharing needed
**Warning signs:** Sporadic panics during clone operations.

### Pitfall 3: Amend Without Confirmation
**What goes wrong:** User accidentally rewrites history, loses work.
**Why it happens:** Amend checkbox is easy to accidentally check.
**How to avoid:**
- Always show confirmation dialog before amend
- If user has typed text, ask whether to replace with previous message
- Make amend checkbox visually distinct
**Warning signs:** User complaints about lost commits.

### Pitfall 4: Gitflow Init Race Condition
**What goes wrong:** User clicks init while branch creation is in progress.
**Why it happens:** No loading state during async operation.
**How to avoid:**
- Disable form during init
- Show loading spinner
- Invalidate queries after success
**Warning signs:** Duplicate branches or partial initialization.

### Pitfall 5: Clone to Existing Directory
**What goes wrong:** git2 fails or overwrites existing files.
**Why it happens:** User selects directory that already exists.
**How to avoid:**
- Check if destination exists before clone
- Offer to clone into subdirectory (repo name from URL)
- Show clear error if destination not empty
**Warning signs:** "destination path already exists" errors.

### Pitfall 6: Keyboard Shortcut Conflict
**What goes wrong:** Cmd/Ctrl+Shift+A is specified for amend toggle but already used for "Stage all files".
**Why it happens:** CONTEXT.md specified a shortcut without checking existing usage.
**How to avoid:**
- Use a different shortcut for amend toggle (e.g., Cmd/Ctrl+Shift+M for "aMend")
- Or dispatch custom event from shortcut that commit form listens to
**Warning signs:** Pressing shortcut stages files instead of toggling amend.

## Code Examples

Verified patterns from official sources and existing codebase:

### Clone Progress Enum (Match Existing Pattern)
```typescript
// Source: Extend existing SyncProgress pattern from bindings.ts
export type CloneProgress = 
  | { event: "started"; data: { url: string } }
  | { event: "receiving"; data: { current: number; total: number; bytes: number } }
  | { event: "resolving"; data: { current: number; total: number } }
  | { event: "checkingOut"; data: { current: number; total: number } }
  | { event: "finished"; data: { path: string } }
  | { event: "error"; data: { message: string } };
```

### Folder Picker with Default (Frontend)
```typescript
// Source: Existing WelcomeView.tsx pattern
import { open } from "@tauri-apps/plugin-dialog";

const selectCloneDestination = async (defaultPath?: string) => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Clone Destination",
    defaultPath: defaultPath, // From settings or home dir
  });
  
  return selected as string | null;
};
```

### Gitflow Init Dialog Form
```typescript
// Source: Existing StartFlowDialog.tsx pattern
interface GitflowInitConfig {
  mainBranch: string;     // Detected from repo
  developBranch: string;  // Default: "develop"
  featurePrefix: string;  // Default: "feature/"
  releasePrefix: string;  // Default: "release/"
  hotfixPrefix: string;   // Default: "hotfix/"
  pushDevelop: boolean;   // User checkbox
}
```

### Amend Pre-fill Flow (Frontend)
```typescript
// Source: Match existing CommitForm.tsx mutation pattern
const handleAmendToggle = async (checked: boolean) => {
  if (checked && message.trim()) {
    // User has typed text, confirm before replacing
    const shouldReplace = await showConfirmDialog(
      "Replace message?",
      "Load the previous commit message? Your current text will be replaced."
    );
    if (!shouldReplace) {
      setAmend(false);
      return;
    }
  }
  
  if (checked) {
    const result = await commands.getLastCommitMessage();
    if (result.status === "ok" && result.data) {
      setMessage(result.data);
    }
  }
  setAmend(checked);
};
```

### Amend Commit Confirmation (Before Execute)
```typescript
// Source: Match existing dialog patterns
const handleCommit = async () => {
  if (amend) {
    const confirmed = await showConfirmDialog(
      "Amend Commit?",
      "This will rewrite the last commit. This cannot be undone if the commit was pushed. Continue?"
    );
    if (!confirmed) return;
  }
  
  commitMutation.mutate(message);
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Git CLI subprocess | git2 library | Always (in this codebase) | Consistent error handling, type safety |
| Polling progress | Tauri Channels | Tauri 2.0 | Real-time progress without polling |
| Modal progress dialogs | Inline progress | Decision in CONTEXT.md | Better UX, non-blocking |

**Deprecated/outdated:**
- `tauri::api::dialog` - Use `tauri-plugin-dialog` instead (Tauri 2.0 change)

## Open Questions

Things that couldn't be fully resolved:

1. **Clone Cancellation**
   - What we know: git2 callbacks return bool, returning false cancels operation
   - What's unclear: How to propagate cancellation from frontend to backend mid-clone
   - Recommendation: Defer cancellation to future phase, clone is typically fast

2. **Default Clone Path**
   - What we know: Settings store exists, can add `defaultClonePath` setting
   - What's unclear: Best default if user hasn't configured (home dir? documents?)
   - Recommendation: Use OS home directory as initial default, let user change via settings

3. **Gitflow Branch Prefix Storage**
   - What we know: Standard gitflow tools use `.git/config` under `[gitflow "prefix"]`
   - What's unclear: Whether to read these on startup or query on demand
   - Recommendation: Query on demand from existing `get_gitflow_status` command

4. **Keyboard Shortcut for Amend**
   - What we know: CONTEXT.md specifies Cmd/Ctrl+Shift+A, but this is used for "Stage all"
   - What's unclear: Whether to reassign "Stage all" or use different shortcut for amend
   - Recommendation: Use Cmd/Ctrl+Shift+M for amend, keep Shift+A for stage all

## Sources

### Primary (HIGH confidence)
- [git2-rs/examples/clone.rs](https://github.com/rust-lang/git2-rs/blob/master/examples/clone.rs) - Official clone example
- [docs.rs/git2/RepoBuilder](https://docs.rs/git2/latest/git2/build/struct.RepoBuilder.html) - Clone builder API
- [docs.rs/git2/RemoteCallbacks](https://docs.rs/git2/latest/git2/struct.RemoteCallbacks.html) - Progress callback API
- [Tauri v2 Dialog Plugin](https://v2.tauri.app/plugin/dialog/) - Folder picker API

### Secondary (MEDIUM confidence)
- [Dev.to: Git Clone with Tauri and git2](https://dev.to/yexiyue/how-to-implement-git-clone-operation-progress-display-and-cancellation-in-rust-with-tauri-and-git2-37ec) - Tauri-specific implementation pattern

### Codebase (HIGH confidence)
- `src-tauri/src/git/remote.rs` - Existing progress channel pattern
- `src-tauri/src/gitflow/state.rs` - Gitflow context detection
- `src-tauri/src/git/commit.rs` - Amend implementation
- `src/components/sync/SyncButtons.tsx` - Progress channel frontend usage

## Metadata

**Confidence breakdown:**
- Clone implementation: HIGH - Official git2 examples + existing codebase patterns
- Gitflow init: HIGH - Follows standard gitflow conventions + existing command patterns
- Amend pre-fill: HIGH - Simple extension of existing infrastructure

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days - stable domain)
