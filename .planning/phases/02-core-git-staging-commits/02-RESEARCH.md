# Phase 2: Core Git - Staging & Commits - Research

**Researched:** 2026-02-04
**Domain:** git2-rs staging, diffs, commits, push/pull/fetch, history
**Confidence:** HIGH

## Summary

Phase 2 implements the core Git workflow: viewing changes, staging/unstaging files, viewing diffs, committing, and syncing with remotes. The phase builds on the established foundation of git2-rs wrapped in `spawn_blocking` and the tauri-specta type-safe IPC pattern.

The standard approach uses git2-rs `Index` methods for staging (`add_path`, `remove_path`), `Diff` for change visualization, `Repository::commit` for creating commits, and `Remote::push/fetch` for sync operations. For diff viewing, Monaco Editor's `DiffEditor` component provides syntax-highlighted side-by-side and inline views. For commit history, `Revwalk` provides pagination-friendly iteration.

**Critical insight:** Hunk-level staging is NOT natively supported by libgit2/git2-rs. To implement hunk staging, we must manually modify blob content and recalculate diffs — this is complex and should be marked as a stretch goal. File-level staging is fully supported and straightforward.

**Primary recommendation:** Implement file-level staging first with full polish. Defer hunk-level staging to after core functionality is complete. Use Tauri Channels for progress streaming during push/pull/fetch operations. Use `react-virtuoso` for commit history list (variable height items with author/message).

## Standard Stack

The established libraries/tools for this domain:

### Core - Rust Backend (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `git2` | 0.20.x | All git operations | Already installed, battle-tested |
| `tokio` | 1.x | Async runtime with spawn_blocking | Already installed |
| `tauri-specta` | 2.0.0-rc.21 | Type-safe IPC | Already installed |
| `serde` | 1.0.x | Serialization | Already installed |

### New Dependencies - Rust Backend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `auth-git2` | 0.5.x | SSH/HTTPS authentication | Handles credential complexity, integrates with git credential helpers |

### Core - Frontend (Already Installed)

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.x | UI framework | Already installed |
| `zustand` | 5.x | State management | Already installed |
| `@tanstack/react-query` | 5.x | Server state | Already installed |
| `lucide-react` | latest | Icons | Already installed |

### New Dependencies - Frontend

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@monaco-editor/react` | 4.7.x | Diff viewer with syntax highlighting | VS Code's editor, best-in-class diff experience |
| `react-virtuoso` | 4.x | Virtual scroll for commit history | Handles variable height items, simpler API than react-window |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `auth-git2` | `git2_credentials` | auth-git2 has cleaner API and better prompter customization |
| Monaco DiffEditor | Custom diff component | Monaco is battle-tested, handles syntax highlighting automatically |
| `react-virtuoso` | `react-window` | react-window is smaller but requires fixed heights; history items vary |

**Installation:**

```bash
# Rust
cargo add auth-git2

# Frontend
npm install @monaco-editor/react react-virtuoso
```

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/src/
├── git/
│   ├── mod.rs           # Module exports
│   ├── error.rs         # Error types (extend existing)
│   ├── repository.rs    # State management (extend existing)
│   ├── commands.rs      # Tauri commands (extend existing)
│   ├── staging.rs       # NEW: Stage/unstage operations
│   ├── diff.rs          # NEW: Diff generation
│   ├── commit.rs        # NEW: Commit creation
│   ├── history.rs       # NEW: Revwalk and history
│   └── remote.rs        # NEW: Push/pull/fetch
src/
├── components/
│   ├── staging/
│   │   ├── FileList.tsx       # Tree/flat view of changes
│   │   ├── FileItem.tsx       # Single file with status
│   │   ├── StagedFiles.tsx    # Staged section
│   │   ├── UnstagedFiles.tsx  # Unstaged section
│   │   └── UntrackedFiles.tsx # Untracked section
│   ├── diff/
│   │   ├── DiffViewer.tsx     # Monaco wrapper
│   │   └── DiffControls.tsx   # Inline/side-by-side toggle
│   ├── commit/
│   │   ├── CommitForm.tsx     # Message input with validation
│   │   └── CommitHistory.tsx  # Virtual scroll history
│   └── sync/
│       ├── SyncButtons.tsx    # Push/Pull/Fetch
│       └── SyncProgress.tsx   # Channel-driven progress
├── stores/
│   └── staging.ts             # NEW: Staging state
```

### Pattern 1: File Status Grouping

**What:** Group changed files by status (Staged, Unstaged, Untracked) with counts
**When to use:** Displaying the file list in staging view

**Rust side:**
```rust
// Source: git2 docs + project pattern
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub status: FileStatus,
    pub additions: Option<i32>,
    pub deletions: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed { old_path: String },
    Untracked,
    Conflicted,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StagingStatus {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<FileChange>,
}
```

### Pattern 2: Diff Generation with Context

**What:** Generate unified diff with configurable context lines
**When to use:** Displaying file diffs

```rust
// Source: https://docs.rs/git2/latest/git2/struct.DiffOptions.html
pub async fn get_file_diff(
    path: String,
    context_lines: u32,
    state: State<'_, RepositoryState>,
) -> Result<FileDiff, GitError> {
    let repo_path = state.get_path().await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut opts = git2::DiffOptions::new();
        opts.context_lines(context_lines)
            .pathspec(&path);
        
        let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
        
        // Collect diff content
        let mut content = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            if let Ok(text) = std::str::from_utf8(line.content()) {
                let prefix = match line.origin() {
                    '+' => "+",
                    '-' => "-",
                    ' ' => " ",
                    _ => "",
                };
                content.push_str(prefix);
                content.push_str(text);
            }
            true
        })?;
        
        Ok(FileDiff { path, content })
    }).await?
}
```

### Pattern 3: Tauri Channel for Progress

**What:** Stream progress events during long operations
**When to use:** Push, pull, fetch, clone operations

```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::ipc::Channel;

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum SyncProgress {
    Started { operation: String },
    Counting { current: usize, total: usize },
    Compressing { current: usize, total: usize },
    Transferring { current: usize, total: usize, bytes: usize },
    Finished { operation: String },
    Error { message: String },
}

#[tauri::command]
#[specta::specta]
pub async fn push_to_remote(
    remote: String,
    on_progress: Channel<SyncProgress>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await?;
    
    on_progress.send(SyncProgress::Started { 
        operation: "push".to_string() 
    })?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut remote = repo.find_remote(&remote)?;
        
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.push_transfer_progress(|current, total, bytes| {
            let _ = on_progress.send(SyncProgress::Transferring {
                current, total, bytes
            });
        });
        
        let mut opts = git2::PushOptions::new();
        opts.remote_callbacks(callbacks);
        
        remote.push(&["refs/heads/main:refs/heads/main"], Some(&mut opts))?;
        
        on_progress.send(SyncProgress::Finished { 
            operation: "push".to_string() 
        })?;
        
        Ok(())
    }).await?
}
```

**Frontend Channel usage:**
```typescript
// Source: https://v2.tauri.app/develop/calling-frontend/
import { Channel } from '@tauri-apps/api/core';

const onProgress = new Channel<SyncProgress>();
onProgress.onmessage = (event) => {
  switch (event.event) {
    case 'started':
      setStatus('started');
      break;
    case 'transferring':
      setProgress(event.data.current / event.data.total);
      break;
    case 'finished':
      setStatus('complete');
      break;
  }
};

await commands.pushToRemote({ remote: 'origin', onProgress });
```

### Pattern 4: Commit Creation Flow

**What:** Stage files, create tree, create commit
**When to use:** User commits staged changes

```rust
// Source: https://github.com/rust-lang/git2-rs/issues/561
#[tauri::command]
#[specta::specta]
pub async fn create_commit(
    message: String,
    amend: bool,
    state: State<'_, RepositoryState>,
) -> Result<CommitInfo, GitError> {
    let repo_path = state.get_path().await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let sig = repo.signature()?;
        
        let mut index = repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        
        let oid = if amend {
            let head = repo.head()?.peel_to_commit()?;
            let parents: Vec<_> = head.parents().collect();
            let parent_refs: Vec<_> = parents.iter().collect();
            
            repo.commit(
                Some("HEAD"),
                &sig,
                &sig,
                &message,
                &tree,
                &parent_refs,
            )?
        } else {
            let parent = repo.head().ok()
                .and_then(|h| h.peel_to_commit().ok());
            
            let parents: Vec<&git2::Commit> = parent.iter().collect();
            
            repo.commit(
                Some("HEAD"),
                &sig,
                &sig,
                &message,
                &tree,
                &parents,
            )?
        };
        
        Ok(CommitInfo {
            oid: oid.to_string(),
            message,
        })
    }).await?
}
```

### Pattern 5: History Pagination with Revwalk

**What:** Load commit history in pages for virtual scrolling
**When to use:** Displaying commit history list

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Revwalk.html
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub oid: String,
    pub short_oid: String,
    pub message_subject: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64, // Unix timestamp
    pub files_changed: usize,
}

#[tauri::command]
#[specta::specta]
pub async fn get_commit_history(
    skip: usize,
    limit: usize,
    state: State<'_, RepositoryState>,
) -> Result<Vec<CommitSummary>, GitError> {
    let repo_path = state.get_path().await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut revwalk = repo.revwalk()?;
        
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;
        
        let commits: Vec<CommitSummary> = revwalk
            .skip(skip)
            .take(limit)
            .filter_map(|oid| oid.ok())
            .filter_map(|oid| {
                let commit = repo.find_commit(oid).ok()?;
                let author = commit.author();
                
                Some(CommitSummary {
                    oid: oid.to_string(),
                    short_oid: format!("{:.7}", oid),
                    message_subject: commit.summary()
                        .unwrap_or("")
                        .to_string(),
                    author_name: author.name()
                        .unwrap_or("Unknown")
                        .to_string(),
                    author_email: author.email()
                        .unwrap_or("")
                        .to_string(),
                    timestamp: author.when().seconds(),
                    files_changed: 0, // Computed separately if needed
                })
            })
            .collect();
        
        Ok(commits)
    }).await?
}
```

### Anti-Patterns to Avoid

- **Loading all commits at once:** Use pagination with skip/limit, never load entire history
- **Blocking async runtime:** Always wrap git2 calls in `spawn_blocking`
- **Storing Repository in state:** Store the path, open Repository per-operation
- **Sending raw diffs across IPC:** For very large diffs, consider chunking or streaming
- **Mixing staged/unstaged logic:** Keep them conceptually separate in code

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff viewing | Custom diff renderer | Monaco DiffEditor | Syntax highlighting, line numbers, side-by-side built-in |
| Virtual scrolling | DOM virtualization | react-virtuoso | Edge cases (resize, variable height, scroll restoration) |
| SSH/HTTPS auth | Credential handling | auth-git2 | SSH agent, credential helper, encrypted keys all handled |
| Progress streaming | Custom WebSocket | Tauri Channels | Built for this, handles ordering and cleanup |
| Commit message parsing | Regex for subject/body | Split on first `\n\n` | Git convention is blank line separator |

**Key insight:** Monaco Editor handles diff rendering completely — syntax highlighting, line numbers, scrolling, side-by-side vs inline. Don't rebuild this.

## Common Pitfalls

### Pitfall 1: Forgetting to Write Index

**What goes wrong:** Files staged but `index.write()` not called, changes lost on next operation
**Why it happens:** `add_path` modifies in-memory index only
**How to avoid:** Always call `index.write()` after staging operations
**Warning signs:** Staged files disappear after other operations

```rust
// WRONG
index.add_path(Path::new("file.txt"))?;
// Index not persisted!

// CORRECT
index.add_path(Path::new("file.txt"))?;
index.write()?; // Persist to disk
```

### Pitfall 2: Path Must Be Relative to Repo Root

**What goes wrong:** `add_path` fails silently or errors
**Why it happens:** git2 expects paths relative to repository root, not absolute
**How to avoid:** Strip repo prefix from all paths before staging operations
**Warning signs:** "File not found" errors for files that exist

```rust
// WRONG
index.add_path(Path::new("/Users/dev/project/src/file.rs"))?;

// CORRECT
index.add_path(Path::new("src/file.rs"))?;
```

### Pitfall 3: Authentication Callback Invoked Multiple Times

**What goes wrong:** User prompted repeatedly for credentials, or operation hangs
**Why it happens:** git2 retries auth on failure, callback must handle this
**How to avoid:** Use `auth-git2` which handles retry logic properly
**Warning signs:** Infinite password prompts, hanging fetch/push

### Pitfall 4: No Commits Yet (Unborn Branch)

**What goes wrong:** `repo.head()` returns error on fresh repository
**Why it happens:** HEAD points to unborn branch (no commits)
**How to avoid:** Handle `ErrorCode::UnbornBranch` explicitly
**Warning signs:** Crash on fresh repositories

```rust
match repo.head() {
    Ok(head) => { /* normal case */ }
    Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
        // Fresh repo, no parent for first commit
    }
    Err(e) => return Err(e.into()),
}
```

### Pitfall 5: Remote Operations Need Refspecs

**What goes wrong:** Push/fetch does nothing or pushes wrong refs
**Why it happens:** Empty refspec array means "use configured", not "push current"
**How to avoid:** Explicitly specify refspecs
**Warning signs:** Push completes but nothing appears on remote

```rust
// For pushing current branch to origin
let refspec = format!(
    "refs/heads/{}:refs/heads/{}", 
    branch_name, 
    branch_name
);
remote.push(&[&refspec], Some(&mut push_opts))?;
```

### Pitfall 6: Detached HEAD State

**What goes wrong:** Commits create without updating any branch
**Why it happens:** User checked out a commit directly, not a branch
**How to avoid:** Detect and warn user, or update HEAD directly
**Warning signs:** Commits "disappear" after checkout

## Code Examples

### Complete Staging Flow

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Index.html
#[tauri::command]
#[specta::specta]
pub async fn stage_file(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;
        
        // Path must be relative to repo root
        index.add_path(Path::new(&path))?;
        index.write()?;
        
        Ok(())
    }).await?
}

#[tauri::command]
#[specta::specta]
pub async fn unstage_file(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let head = repo.head()?.peel_to_commit()?;
        
        // Reset file in index to HEAD state
        repo.reset_default(Some(&head.into_object()), [&path])?;
        
        Ok(())
    }).await?
}

#[tauri::command]
#[specta::specta]
pub async fn stage_all(
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;
        
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;
        
        Ok(())
    }).await?
}
```

### Monaco DiffEditor Integration

```tsx
// Source: https://www.npmjs.com/package/@monaco-editor/react
import { DiffEditor } from '@monaco-editor/react';

interface DiffViewerProps {
  original: string;
  modified: string;
  language: string;
  inline?: boolean;
}

export function DiffViewer({ 
  original, 
  modified, 
  language, 
  inline = true 
}: DiffViewerProps) {
  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: !inline,
        originalEditable: false,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
      }}
    />
  );
}
```

### Virtual Scroll History List

```tsx
// Source: https://virtuoso.dev/
import { Virtuoso } from 'react-virtuoso';
import { useInfiniteQuery } from '@tanstack/react-query';
import { commands } from '../bindings';

export function CommitHistory() {
  const PAGE_SIZE = 50;
  
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['commits'],
    queryFn: ({ pageParam = 0 }) => 
      commands.getCommitHistory({ skip: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => 
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
  });
  
  const commits = data?.pages.flat() ?? [];
  
  return (
    <Virtuoso
      data={commits}
      endReached={() => hasNextPage && fetchNextPage()}
      itemContent={(index, commit) => (
        <CommitRow key={commit.oid} commit={commit} />
      )}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `git2_credentials` | `auth-git2` | 2024 | Cleaner API, better prompter customization |
| react-window for all | react-virtuoso for variable | 2023+ | Simpler API for dynamic heights |
| Events for progress | Channels for streaming | Tauri 2.0 | Better performance, ordering guarantees |
| Manual IPC types | tauri-specta | 2024 | No type sync bugs |

**Current state:**
- git2-rs 0.20.x is stable and feature-complete for our needs
- Monaco Editor 4.7.x is the standard for diff viewing
- auth-git2 is preferred over git2_credentials for new projects

**Note on hunk staging:** libgit2 (and thus git2-rs) does NOT support native hunk/line-level staging. The feature request ([#589](https://github.com/rust-lang/git2-rs/issues/589)) is open. Implementing this requires manually manipulating blob content — a complex undertaking best deferred.

## Open Questions

Things that couldn't be fully resolved:

1. **Hunk-level staging complexity**
   - What we know: libgit2 doesn't support it natively, requires blob manipulation
   - What's unclear: Best algorithm for modifying blobs to stage hunks
   - Recommendation: Defer to after file-level staging is complete; treat as stretch goal

2. **Authentication UI integration**
   - What we know: auth-git2 supports custom prompters
   - What's unclear: Best way to integrate with Tauri dialog for password prompts
   - Recommendation: Start with SSH agent only; add password prompts in polish phase

3. **Conflict detection before pull**
   - What we know: Can detect via fetch + merge-base analysis
   - What's unclear: Exact algorithm for "would this pull cause conflicts?"
   - Recommendation: Use fetch preview to show incoming commits; warn if local has uncommitted changes

## Sources

### Primary (HIGH confidence)
- [git2 Index documentation](https://docs.rs/git2/latest/git2/struct.Index.html) - staging methods
- [git2 Diff documentation](https://docs.rs/git2/latest/git2/struct.Diff.html) - diff operations
- [git2 Revwalk documentation](https://docs.rs/git2/latest/git2/struct.Revwalk.html) - history traversal
- [git2 Remote documentation](https://docs.rs/git2/latest/git2/struct.Remote.html) - push/fetch
- [Tauri v2 Calling Frontend](https://v2.tauri.app/develop/calling-frontend/) - Channels for streaming
- [@monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react) - DiffEditor component
- [auth-git2 documentation](https://docs.rs/auth-git2/latest/auth_git2/) - authentication

### Secondary (MEDIUM confidence)
- [git2-rs examples/diff.rs](https://github.com/rust-lang/git2-rs/blob/master/examples/diff.rs) - diff patterns
- [git2-rs examples/log.rs](https://github.com/rust-lang/git2-rs/blob/master/examples/log.rs) - history patterns
- [react-virtuoso vs react-window comparison](https://dev.to/sanamumtaz/react-virtualization-react-window-vs-react-virtuoso-8g)

### Tertiary (LOW confidence)
- [Hunk staging issue #589](https://github.com/rust-lang/git2-rs/issues/589) - Feature discussion, not implemented
- [Tauri channel memory leak issue](https://github.com/tauri-apps/tauri/issues/13133) - Known issue, monitor

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - git2-rs is established, Monaco is VS Code's editor
- Architecture: HIGH - Patterns match Phase 1 foundation, verified with official docs
- Pitfalls: HIGH - Documented in existing PITFALLS.md + verified with git2 docs
- Hunk staging: LOW - Not natively supported, complex workaround needed

**Research date:** 2026-02-04
**Valid until:** 30 days (stable domain)
