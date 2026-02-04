# Phase 4 Research: Gitflow State Machine

**Phase:** 4 - Gitflow State Machine
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

Implement Gitflow workflow enforcement using the `statig` crate for state machine logic. The state machine prevents invalid operations at the backend level, with status exposed to frontend for UI disabling. Key insight: no-fast-forward merges require manual implementation since git2-rs lacks native `--no-ff` support.

## Standard Stack

### State Machine: statig

**Why statig over alternatives:**
- Hierarchical states (Gitflow needs Idle → Feature/Release/Hotfix substates)
- Entry/exit actions for setup/cleanup
- State introspection via `.state()` method
- Maintained, Rust 1.65.0+ compatible
- Derive macro reduces boilerplate

**Dependency:**
```toml
statig = "0.3"
```

**Alternatives considered:**
- `rust-fsm` - Too simple, no hierarchical states
- `finny` - More complex than needed
- Hand-rolled enum - Misses guard/transition patterns

### Git Operations: Existing git2-rs

Reuse Phase 3's git2-rs infrastructure:
- `spawn_blocking` pattern already established
- Branch operations exist (create, checkout, delete, merge)
- Thread-safe `Arc<Mutex<Repository>>` wrapper in place

## Architecture

### Module Structure

```
src-tauri/src/gitflow/
├── mod.rs           # Module exports
├── machine.rs       # statig state machine definition
├── commands.rs      # Tauri IPC commands
├── state.rs         # GitflowState wrapper with transitions
└── policy.rs        # Validation helpers (branch name parsing, etc.)
```

### State Machine Design

```rust
use statig::prelude::*;

#[derive(Debug, Clone)]
pub enum GitflowState {
    Idle,
    Feature { name: String },
    Release { version: String },
    Hotfix { name: String },
}

#[derive(Debug)]
pub enum Event {
    StartFeature { name: String },
    FinishFeature,
    StartRelease { version: String },
    FinishRelease { tag_message: String },
    StartHotfix { name: String },
    FinishHotfix { tag_message: String },
    Abort,
}

#[derive(Debug)]
pub struct GitflowMachine {
    state: GitflowState,
}

impl StateMachine for GitflowMachine {
    type State = GitflowState;
    type Event = Event;
    
    fn state(&self) -> &Self::State {
        &self.state
    }
    
    // Transitions defined via guards and actions
}
```

### State Transitions

```
Idle ──StartFeature──► Feature
     ◄──FinishFeature──┘

Idle ──StartRelease──► Release
     ◄──FinishRelease──┘

Idle ──StartHotfix───► Hotfix
     ◄──FinishHotfix───┘

Any ───Abort────────► Idle
```

### Guards (Pre-conditions)

| Event | Guard |
|-------|-------|
| StartFeature | `current_branch == "develop"` |
| FinishFeature | `current_branch.starts_with("feature/")` |
| StartRelease | `current_branch == "develop"` AND `no active release` |
| FinishRelease | `current_branch.starts_with("release/")` |
| StartHotfix | `current_branch == "main"` OR `current_branch == "master"` |
| FinishHotfix | `current_branch.starts_with("hotfix/")` |

## Key Implementation Details

### No-Fast-Forward Merge

git2-rs `MergeOptions` lacks `--no-ff` flag. Solution: always create merge commit even when fast-forward is possible.

```rust
pub fn merge_no_ff(
    repo: &Repository,
    source_branch: &str,
    target_branch: &str,
    message: &str,
) -> Result<Oid, GitflowError> {
    // 1. Checkout target branch
    checkout_branch(repo, target_branch)?;
    
    // 2. Get source and target commits
    let source_commit = repo
        .find_branch(source_branch, BranchType::Local)?
        .get()
        .peel_to_commit()?;
    let target_commit = repo.head()?.peel_to_commit()?;
    
    // 3. Perform merge analysis
    let (analysis, _) = repo.merge_analysis(&[&source_commit.as_object().as_annotated_commit()?])?;
    
    // 4. Even if fast-forward possible, create merge commit
    if analysis.is_fast_forward() || analysis.is_normal() {
        // Perform the merge to get tree
        repo.merge(&[&annotated], None, None)?;
        
        // Create merge commit with two parents
        let tree_oid = repo.index()?.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        let signature = repo.signature()?;
        
        let commit_oid = repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&target_commit, &source_commit], // Two parents = merge commit
        )?;
        
        // Clean up merge state
        repo.cleanup_state()?;
        
        Ok(commit_oid)
    } else if analysis.is_unborn() {
        Err(GitflowError::UnbornHead)
    } else {
        Err(GitflowError::MergeConflict)
    }
}
```

### Gitflow Status for UI

Expose state and valid actions to frontend:

```rust
#[derive(Serialize, Type)]
pub struct GitflowStatus {
    pub state: GitflowStateDto,
    pub current_branch: String,
    pub can_start_feature: bool,
    pub can_finish_feature: bool,
    pub can_start_release: bool,
    pub can_finish_release: bool,
    pub can_start_hotfix: bool,
    pub can_finish_hotfix: bool,
    pub can_abort: bool,
    pub active_flow: Option<ActiveFlow>,
}

#[derive(Serialize, Type)]
pub struct ActiveFlow {
    pub flow_type: FlowType,  // Feature, Release, Hotfix
    pub name: String,
    pub source_branch: String,
}
```

### State Reconstruction on Startup

Derive Gitflow state from Git state (no external persistence):

```rust
pub fn reconstruct_state(repo: &Repository) -> GitflowState {
    let current_branch = get_current_branch_name(repo);
    
    match current_branch.as_str() {
        name if name.starts_with("feature/") => {
            GitflowState::Feature { name: name[8..].to_string() }
        }
        name if name.starts_with("release/") => {
            GitflowState::Release { version: name[8..].to_string() }
        }
        name if name.starts_with("hotfix/") => {
            GitflowState::Hotfix { name: name[7..].to_string() }
        }
        _ => GitflowState::Idle,
    }
}
```

### Complete Flow Implementations

**Start Feature:**
```rust
pub async fn start_feature(name: String) -> Result<(), GitflowError> {
    // 1. Verify on develop
    let current = get_current_branch()?;
    if current != "develop" {
        return Err(GitflowError::InvalidContext {
            expected: "develop".into(),
            actual: current,
        });
    }
    
    // 2. Create and checkout feature branch
    let branch_name = format!("feature/{}", name);
    create_branch(&branch_name)?;
    checkout_branch(&branch_name)?;
    
    // 3. Update state machine
    machine.handle(Event::StartFeature { name });
    
    Ok(())
}
```

**Finish Feature:**
```rust
pub async fn finish_feature() -> Result<(), GitflowError> {
    // 1. Get current feature name
    let current = get_current_branch()?;
    let feature_name = current.strip_prefix("feature/")
        .ok_or(GitflowError::NotOnFeatureBranch)?;
    
    // 2. Merge to develop with --no-ff
    let message = format!("Merge branch '{}' into develop", current);
    merge_no_ff(&current, "develop", &message)?;
    
    // 3. Delete feature branch
    delete_branch(&current)?;
    
    // 4. Update state machine
    machine.handle(Event::FinishFeature);
    
    Ok(())
}
```

**Finish Release (dual merge + tag):**
```rust
pub async fn finish_release(tag_message: String) -> Result<(), GitflowError> {
    let current = get_current_branch()?;
    let version = current.strip_prefix("release/")
        .ok_or(GitflowError::NotOnReleaseBranch)?;
    
    // 1. Merge to main with --no-ff
    let main_message = format!("Merge branch '{}' into main", current);
    merge_no_ff(&current, "main", &main_message)?;
    
    // 2. Tag on main
    create_tag(&format!("v{}", version), &tag_message)?;
    
    // 3. Merge to develop with --no-ff
    let develop_message = format!("Merge branch '{}' into develop", current);
    merge_no_ff(&current, "develop", &develop_message)?;
    
    // 4. Delete release branch
    delete_branch(&current)?;
    
    // 5. Update state machine
    machine.handle(Event::FinishRelease { tag_message });
    
    Ok(())
}
```

## Error Types

```rust
#[derive(Debug, Error, Serialize, Type)]
pub enum GitflowError {
    #[error("Must be on {expected} branch, currently on {actual}")]
    InvalidContext { expected: String, actual: String },
    
    #[error("Not on a feature branch")]
    NotOnFeatureBranch,
    
    #[error("Not on a release branch")]
    NotOnReleaseBranch,
    
    #[error("Not on a hotfix branch")]
    NotOnHotfixBranch,
    
    #[error("A release is already in progress: {0}")]
    ReleaseInProgress(String),
    
    #[error("A hotfix is already in progress: {0}")]
    HotfixInProgress(String),
    
    #[error("Merge conflict detected - resolve before continuing")]
    MergeConflict,
    
    #[error("Cannot operate on unborn HEAD")]
    UnbornHead,
    
    #[error("Branch {0} does not exist")]
    BranchNotFound(String),
    
    #[error("Branch {0} already exists")]
    BranchExists(String),
    
    #[error("External state change detected - please refresh")]
    StateDrift,
    
    #[error("Git error: {0}")]
    Git(String),
}
```

## Frontend Integration

### Store Pattern

```typescript
// stores/gitflowStore.ts
interface GitflowStore {
  status: GitflowStatus | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  startFeature: (name: string) => Promise<void>;
  finishFeature: () => Promise<void>;
  startRelease: (version: string) => Promise<void>;
  finishRelease: (tagMessage: string) => Promise<void>;
  startHotfix: (name: string) => Promise<void>;
  finishHotfix: (tagMessage: string) => Promise<void>;
  abort: () => Promise<void>;
}
```

### UI Disabling Pattern

```tsx
function GitflowPanel() {
  const { status } = useGitflowStore();
  
  return (
    <div>
      <Button 
        onClick={handleStartFeature}
        disabled={!status?.can_start_feature}
        title={!status?.can_start_feature 
          ? "Switch to develop branch to start a feature" 
          : undefined}
      >
        Start Feature
      </Button>
      {/* Similar for other buttons */}
    </div>
  );
}
```

## Common Pitfalls

### 1. State Drift from External Git Commands

**Problem:** User runs `git checkout main` in terminal while app shows Feature state.

**Solution:** 
- Verify Git state matches state machine before operations
- Re-sync on window focus
- Re-sync before any Gitflow operation

```rust
pub fn verify_state_consistency(repo: &Repository, expected: &GitflowState) -> Result<(), GitflowError> {
    let actual = reconstruct_state(repo);
    if actual != *expected {
        return Err(GitflowError::StateDrift);
    }
    Ok(())
}
```

### 2. Merge Conflicts During Finish

**Problem:** Conflicts during `finish_release` after merging to main but before merging to develop.

**Solution:**
- Detect conflicts early
- Return to pre-operation state on failure
- Store intermediate state for resume

### 3. Missing main/develop Branches

**Problem:** Repository not initialized with Gitflow branches.

**Solution:**
- Check for main AND develop on Gitflow operations
- Offer initialization command
- Clear error message: "Repository needs main and develop branches for Gitflow"

### 4. Branch Name Collisions

**Problem:** User has existing `feature/login` branch, tries to start same feature.

**Solution:**
- Check branch existence before creation
- Return `GitflowError::BranchExists`

## Testing Strategy

### Unit Tests
- State machine transitions
- Guard conditions
- Branch name parsing

### Integration Tests
- Full flow: start → work → finish
- Conflict handling
- State reconstruction

### E2E Tests
- UI button enabling/disabling
- Error message display
- Multi-step flows

## Open Questions for Planner

1. **Multiple concurrent features**: v1 enforces single-flow simplicity. Document multi-flow as v2.
2. **Persist state vs derive**: Recommendation is derive from Git - no external storage needed.
3. **External sync frequency**: Window focus + before operations (both).

## References

- statig crate: https://docs.rs/statig/latest/statig/
- Gitflow workflow: https://nvie.com/posts/a-successful-git-branching-model/
- git2-rs merge: https://docs.rs/git2/latest/git2/struct.Repository.html#method.merge
