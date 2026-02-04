# Phase 3: Core Git - Branches - Research

**Researched:** 2026-02-04
**Domain:** git2-rs branch, checkout, merge, stash, tag operations
**Confidence:** HIGH

## Summary

Phase 3 implements branch management, merge operations, stash, and tags. The phase builds on the established foundation of git2-rs wrapped in `spawn_blocking` and the tauri-specta type-safe IPC pattern from Phases 1-2.

The standard approach uses git2-rs `Repository::branch()` for creation, `Branch::delete()` for removal, `set_head()` + `checkout_head()` for switching branches, `merge()` with `MergeAnalysis` for merging, stash methods for temporary storage, and `tag()`/`tag_lightweight()` for tagging.

**Critical insight:** Branch checkout in git2-rs is NOT a single operation. It requires: (1) `set_head()` to point HEAD to the branch reference, (2) `checkout_head()` to update the working directory. Merge operations should always check `merge_analysis()` first to determine if fast-forward is possible.

**Primary recommendation:** Follow the established pattern of spawn_blocking for all git2 calls. Implement branch listing with pagination for large repos. Use `MergeAnalysis` to determine merge strategy before executing. Provide clear conflict UI when merges fail.

## Standard Stack

The established libraries/tools for this domain:

### Core - Rust Backend (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `git2` | 0.20.x | All git operations | Already installed, battle-tested |
| `tokio` | 1.x | Async runtime with spawn_blocking | Already installed |
| `tauri-specta` | 2.0.0-rc.21 | Type-safe IPC | Already installed |
| `serde` | 1.x | Serialization | Already installed |

### Core - Frontend (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | 4.x | State management | Already used for repository/staging stores |
| `lucide-react` | Latest | Icons | Already installed |
| `tailwindcss` | 4.x | Styling | Already installed |

### No New Dependencies Required

This phase uses existing dependencies. No new libraries needed.

**Installation:** None required - all dependencies in place.

## Architecture Patterns

### Recommended Module Structure

```
src-tauri/src/git/
├── mod.rs              # Add: pub mod branch; pub mod stash; pub mod tag;
├── branch.rs           # NEW: Branch CRUD operations
├── stash.rs            # NEW: Stash operations  
├── tag.rs              # NEW: Tag operations
├── merge.rs            # NEW: Merge operations (separate from branch)
├── commands.rs         # Existing - may extend
├── repository.rs       # Existing - branch_name already tracked
└── error.rs            # Extend with branch/merge errors

src/
├── stores/
│   ├── branches.ts     # NEW: Branch state management
│   └── repository.ts   # Existing - extend with branch switching
├── components/
│   ├── branches/
│   │   ├── BranchList.tsx       # NEW: List all branches
│   │   ├── BranchItem.tsx       # NEW: Single branch row
│   │   ├── CreateBranchDialog.tsx # NEW: Create branch modal
│   │   └── MergeDialog.tsx      # NEW: Merge confirmation/progress
│   ├── stash/
│   │   ├── StashList.tsx        # NEW: List stashes
│   │   └── StashItem.tsx        # NEW: Single stash entry
│   └── Header.tsx               # Extend - branch selector dropdown
```

### Pattern 1: Two-Step Branch Checkout

**What:** git2-rs checkout requires updating HEAD reference then working directory separately.
**When to use:** Every branch switch operation.
**Example:**
```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html
pub async fn checkout_branch(path: String, branch_name: String) -> Result<(), GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        
        // Step 1: Point HEAD to the branch
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        
        // Step 2: Update working directory to match HEAD
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.safe(); // Don't overwrite local changes
        repo.checkout_head(Some(&mut checkout_opts))?;
        
        Ok(())
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### Pattern 2: Merge with Analysis First

**What:** Check merge analysis before attempting merge to determine strategy.
**When to use:** Every merge operation.
**Example:**
```rust
// Source: https://docs.rs/git2/latest/git2/struct.MergeAnalysis.html
pub async fn merge_branch(
    path: String, 
    source_branch: String
) -> Result<MergeResult, GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        
        // Find the branch to merge
        let source = repo.find_branch(&source_branch, BranchType::Local)?;
        let source_commit = source.get().peel_to_commit()?;
        let annotated = repo.find_annotated_commit(source_commit.id())?;
        
        // Analyze what kind of merge is needed
        let (analysis, _preference) = repo.merge_analysis(&[&annotated])?;
        
        if analysis.is_up_to_date() {
            return Ok(MergeResult::UpToDate);
        }
        
        if analysis.is_fast_forward() {
            // Fast-forward: just move the branch pointer
            let refname = format!("refs/heads/{}", /* current branch */);
            repo.reference(
                &refname,
                source_commit.id(),
                true,
                &format!("Fast-forward merge from {}", source_branch),
            )?;
            repo.checkout_head(Some(&mut CheckoutBuilder::new().force()))?;
            return Ok(MergeResult::FastForward);
        }
        
        // Normal merge: creates merge commit
        repo.merge(&[&annotated], None, None)?;
        
        // Check for conflicts
        let index = repo.index()?;
        if index.has_conflicts() {
            return Ok(MergeResult::Conflicts);
        }
        
        // Auto-commit if no conflicts
        // ... create merge commit ...
        
        Ok(MergeResult::Merged)
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### Pattern 3: Stash with Flags

**What:** Stash operations with configurable behavior for untracked files.
**When to use:** All stash save operations.
**Example:**
```rust
// Source: https://github.com/rust-lang/git2-rs/blob/master/src/stash.rs
pub async fn stash_save(
    path: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<Oid, GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        let signature = repo.signature()?;
        
        let flags = if include_untracked {
            Some(StashFlags::INCLUDE_UNTRACKED)
        } else {
            None
        };
        
        let oid = repo.stash_save(
            &signature,
            message.as_deref().unwrap_or("WIP"),
            flags,
        )?;
        
        Ok(oid)
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### Pattern 4: Branch Protection Before Delete

**What:** Check if branch is merged before allowing deletion.
**When to use:** All branch delete operations.
**Example:**
```rust
pub async fn delete_branch(
    path: String,
    branch_name: String,
    force: bool,
) -> Result<(), GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        let mut branch = repo.find_branch(&branch_name, BranchType::Local)?;
        
        // Safety check: prevent deleting current branch
        if branch.is_head() {
            return Err(GitError::OperationFailed(
                "Cannot delete the currently checked out branch".to_string()
            ));
        }
        
        // Check if branch is merged (unless force)
        if !force {
            // Get default branch (main/master/develop)
            let head = repo.head()?;
            let head_commit = head.peel_to_commit()?;
            let branch_commit = branch.get().peel_to_commit()?;
            
            // Check if branch commit is ancestor of HEAD
            let is_merged = repo.merge_base(head_commit.id(), branch_commit.id())
                .map(|base| base == branch_commit.id())
                .unwrap_or(false);
            
            if !is_merged {
                return Err(GitError::OperationFailed(
                    format!("Branch '{}' is not fully merged. Use force to delete.", branch_name)
                ));
            }
        }
        
        branch.delete()?;
        Ok(())
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### Anti-Patterns to Avoid

- **Single checkout call:** There is no single `checkout_branch()` method. Always use `set_head()` + `checkout_head()`.
- **Merge without analysis:** Always call `merge_analysis()` first to check if fast-forward is possible.
- **Force delete without warning:** Always check if branch is merged before deletion, show warning UI.
- **Blocking async runtime:** All git2 calls must be in `spawn_blocking`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Branch name validation | Custom regex | `Branch::name_is_valid()` | Edge cases with refs |
| Merge base finding | Manual traversal | `repo.merge_base()` | Optimized algorithm |
| Conflict detection | Parse conflict markers | `index.has_conflicts()` | Reliable detection |
| Stash iteration | Manual ref parsing | `repo.stash_foreach()` | Correct ordering |
| Tag listing | Manual refs/tags walk | `repo.tag_names()` | Pattern matching support |

**Key insight:** git2-rs has specific methods for nearly every operation. Check the docs before implementing custom solutions.

## Common Pitfalls

### Pitfall 1: Checkout Overwrites Local Changes

**What goes wrong:** Using `CheckoutBuilder::force()` destroys uncommitted work.
**Why it happens:** Developer assumes checkout is "safe" like git CLI.
**How to avoid:** 
- Default to `CheckoutBuilder::safe()` 
- Check for dirty state before checkout
- Offer stash option if dirty
**Warning signs:** User loses work after branch switch.

### Pitfall 2: Merge Leaves Repository in Conflicted State

**What goes wrong:** After `merge()` with conflicts, repository is in mid-merge state.
**Why it happens:** Forgot to handle conflict case, user abandons app.
**How to avoid:**
- Always check `index.has_conflicts()` after merge
- Provide clear "abort merge" option (`repo.cleanup_state()`)
- Save merge state to show UI on next app open
**Warning signs:** User can't commit, push, or do other operations.

### Pitfall 3: Stash Index vs Message Confusion

**What goes wrong:** Stash operations use 0-based index, not stash names.
**Why it happens:** UI shows messages, but API uses indices.
**How to avoid:**
- Store stash index with each entry in UI state
- Use `stash_foreach()` to build list with indices
- Map message/hash to index before operations
**Warning signs:** Wrong stash applied or dropped.

### Pitfall 4: Branch Delete on Current Branch

**What goes wrong:** Attempting to delete the currently checked out branch.
**Why it happens:** UI doesn't disable delete button for current branch.
**How to avoid:**
- Check `branch.is_head()` before delete
- Disable delete button in UI for current branch
- Return clear error message
**Warning signs:** Cryptic git2 error.

### Pitfall 5: Fast-Forward Merge Doesn't Create Commit

**What goes wrong:** Developer expects merge commit, gets none on fast-forward.
**Why it happens:** Fast-forward just moves branch pointer.
**How to avoid:**
- Check `MergeAnalysis::is_fast_forward()` 
- For Gitflow (later), always use `--no-ff` equivalent
- UI should indicate "fast-forwarded" vs "merged"
**Warning signs:** Missing merge commit in history.

### Pitfall 6: Tag vs Lightweight Tag Confusion

**What goes wrong:** Creating lightweight tag when annotated was intended.
**Why it happens:** `tag_lightweight()` vs `tag()` are different methods.
**How to avoid:**
- Use `tag()` for annotated tags (with message, tagger)
- Use `tag_lightweight()` only for simple refs
- UI should default to annotated tags
**Warning signs:** Missing tag message, tagger info.

## Code Examples

Verified patterns from official sources:

### List All Local Branches

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html#method.branches
#[tauri::command]
#[specta::specta]
pub async fn list_branches(path: String) -> Result<Vec<BranchInfo>, GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        let mut branches = Vec::new();
        
        for branch_result in repo.branches(Some(BranchType::Local))? {
            let (branch, _branch_type) = branch_result?;
            let name = branch.name()?.unwrap_or("").to_string();
            let is_head = branch.is_head();
            let commit = branch.get().peel_to_commit()?;
            
            branches.push(BranchInfo {
                name,
                is_head,
                last_commit_oid: commit.id().to_string(),
                last_commit_message: commit.summary().unwrap_or("").to_string(),
            });
        }
        
        Ok(branches)
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### Create Branch from HEAD

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html#method.branch
#[tauri::command]
#[specta::specta]
pub async fn create_branch(
    path: String,
    name: String,
    checkout: bool,
) -> Result<BranchInfo, GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        
        // Validate branch name
        if !Branch::name_is_valid(&name)? {
            return Err(GitError::OperationFailed(
                format!("Invalid branch name: {}", name)
            ));
        }
        
        // Get HEAD commit
        let head = repo.head()?;
        let head_commit = head.peel_to_commit()?;
        
        // Create branch
        let branch = repo.branch(&name, &head_commit, false)?;
        
        // Optionally checkout
        if checkout {
            let refname = format!("refs/heads/{}", name);
            repo.set_head(&refname)?;
            repo.checkout_head(Some(&mut CheckoutBuilder::new().safe()))?;
        }
        
        Ok(BranchInfo {
            name,
            is_head: checkout,
            last_commit_oid: head_commit.id().to_string(),
            last_commit_message: head_commit.summary().unwrap_or("").to_string(),
        })
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### List Stashes

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html#method.stash_foreach
#[tauri::command]
#[specta::specta]
pub async fn list_stashes(path: String) -> Result<Vec<StashEntry>, GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        let mut stashes = Vec::new();
        
        repo.stash_foreach(|index, message, oid| {
            stashes.push(StashEntry {
                index,
                message: message.to_string(),
                oid: oid.to_string(),
            });
            true // continue iteration
        })?;
        
        Ok(stashes)
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

### Create Annotated Tag

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html#method.tag
#[tauri::command]
#[specta::specta]
pub async fn create_tag(
    path: String,
    name: String,
    message: String,
    target_oid: Option<String>,
) -> Result<String, GitError> {
    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        let signature = repo.signature()?;
        
        // Get target (default to HEAD)
        let target = match target_oid {
            Some(oid_str) => {
                let oid = Oid::from_str(&oid_str)?;
                repo.find_object(oid, None)?
            }
            None => repo.head()?.peel(ObjectType::Commit)?,
        };
        
        // Create annotated tag
        let oid = repo.tag(&name, &target, &signature, &message, false)?;
        
        Ok(oid.to_string())
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single checkout method | `set_head()` + `checkout_head()` | Always in git2-rs | Must use two-step process |
| `git merge --no-ff` flag | `MergeOptions` + manual commit | Always in git2-rs | Explicit merge commit creation |
| `git stash` subcommands | Index-based stash API | Always in git2-rs | Track indices, not names |

**Deprecated/outdated:**
- None for git2 0.20.x - this is current stable

## Open Questions

Things that couldn't be fully resolved:

1. **Conflict resolution UI design**
   - What we know: `index.has_conflicts()` and `index.conflicts()` provide conflict data
   - What's unclear: Best UX for showing conflicts (inline, 3-way, etc.)
   - Recommendation: Phase 3 should detect conflicts and show message; conflict resolution UI can be enhanced later

2. **Remote branch tracking**
   - What we know: `branch.upstream()` and `branch.set_upstream()` exist
   - What's unclear: Whether to auto-set upstream on branch creation
   - Recommendation: Defer upstream management to remote sync operations

## Sources

### Primary (HIGH confidence)
- [docs.rs/git2 Repository methods](https://docs.rs/git2/latest/git2/struct.Repository.html) - branch, stash, tag, merge APIs
- [docs.rs/git2 Branch struct](https://docs.rs/git2/latest/git2/struct.Branch.html) - Branch management
- [docs.rs/git2 MergeAnalysis](https://docs.rs/git2/latest/git2/struct.MergeAnalysis.html) - Merge types
- [docs.rs/git2 MergeOptions](https://docs.rs/git2/latest/git2/struct.MergeOptions.html) - Merge configuration
- [docs.rs/git2 CheckoutBuilder](https://docs.rs/git2/latest/git2/build/struct.CheckoutBuilder.html) - Checkout configuration
- [docs.rs/git2 Index conflicts](https://docs.rs/git2/latest/git2/struct.Index.html) - Conflict detection

### Secondary (MEDIUM confidence)
- [git2-rs tag.rs example](https://github.com/rust-lang/git2-rs/blob/master/examples/tag.rs) - Tag operations
- [git2-rs stash.rs source](https://github.com/rust-lang/git2-rs/blob/master/src/stash.rs) - Stash implementation

### Tertiary (LOW confidence)
- [Rust users forum discussion](https://users.rust-lang.org/t/using-git2-to-clone-create-a-branch-and-push-a-branch-to-github/100292) - Community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing installed dependencies
- Branch operations: HIGH - verified against docs.rs
- Merge operations: HIGH - MergeAnalysis and patterns verified
- Stash operations: HIGH - API verified, source code reviewed
- Tag operations: HIGH - official examples reviewed

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (stable library, 30 days)
