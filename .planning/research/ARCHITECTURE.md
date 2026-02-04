# FlowForge Architecture

> **Research Dimension**: Architecture  
> **Project**: FlowForge — AI-native Git client (Tauri + Rust + React)  
> **Last Updated**: 2026-02-03

---

## Executive Summary

FlowForge adopts a **layered architecture** with clear boundaries between the React frontend, Tauri IPC layer, and Rust backend services. The Rust backend organizes into discrete modules: Git operations (git2-rs), Gitflow state machine (statig), file system watching (notify-rs), and conventional commit validation.

**Key Architectural Decisions:**
- Use **tauri-specta** for type-safe Rust-TypeScript bindings
- Implement Gitflow enforcement via **statig** hierarchical state machine
- Use **Channels** (not Events) for high-throughput streaming
- Frontend state lives in **Zustand** with backend-initiated sync

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Topology    │  │   Staging    │  │   Commit Composer    │  │
│  │  Visualizer  │  │    Area      │  │   (Rule-based)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Worktree    │  │   Branch     │  │   Settings/Config    │  │
│  │   Panel      │  │   Manager    │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                              │                                  │
│                    ┌─────────▼─────────┐                       │
│                    │   Zustand Store   │                       │
│                    │  (Local UI State) │                       │
│                    └─────────┬─────────┘                       │
└──────────────────────────────┼──────────────────────────────────┘
                               │
              ═══════════════════════════════════
              │  Tauri IPC Bridge (tauri-specta) │
              │  Commands ↓    Events/Channels ↑ │
              ═══════════════════════════════════
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                        Rust Backend                             │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │                    Command Router                          │ │
│  │              (Tauri command handlers)                      │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                  │
│  ┌─────────────┬─────────────┼─────────────┬─────────────────┐ │
│  │             │             │             │                 │ │
│  ▼             ▼             ▼             ▼                 │ │
│ ┌───────┐  ┌────────┐  ┌──────────┐  ┌──────────┐           │ │
│ │ Git   │  │Gitflow │  │  File    │  │ Commit   │           │ │
│ │Service│  │ State  │  │ Watcher  │  │Validator │           │ │
│ │(git2) │  │Machine │  │(notify)  │  │          │           │ │
│ └───┬───┘  └────┬───┘  └────┬─────┘  └────┬─────┘           │ │
│     │          │           │             │                  │ │
│     └──────────┴───────────┴─────────────┘                  │ │
│                      │                                       │ │
│              ┌───────▼───────┐                              │ │
│              │  Repository   │                              │ │
│              │   Context     │                              │ │
│              │  (Shared)     │                              │ │
│              └───────────────┘                              │ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

| Component | Layer | Responsibility | Technology |
|-----------|-------|----------------|------------|
| **Topology Visualizer** | Frontend | DAG rendering, branch graph | React + xyflow |
| **Staging Area** | Frontend | File selection, diff preview | React |
| **Commit Composer** | Frontend | Message editor, suggestions | React |
| **Worktree Panel** | Frontend | Tree view, status indicators | React |
| **Zustand Store** | Frontend | UI state, optimistic updates | Zustand |
| **Command Router** | Backend | Dispatch commands to services | Tauri |
| **Git Service** | Backend | All Git operations | git2-rs |
| **Gitflow State Machine** | Backend | Workflow enforcement | statig |
| **File Watcher** | Backend | Real-time FS monitoring | notify-rs |
| **Commit Validator** | Backend | Conventional commit parsing | Rust regex |
| **Repository Context** | Backend | Shared repo state, caching | Arc<Mutex> |

---

## 3. Boundary Rules

### Frontend MUST NOT:
- Execute Git commands directly
- Access file system outside Tauri APIs
- Store canonical Git state (only cache/optimistic)

### Backend MUST NOT:
- Render UI or manage presentation logic
- Make decisions about visual layout
- Block the main thread with sync operations

### IPC Bridge MUST:
- Serialize all data as JSON or use Channels for streaming
- Validate inputs before processing
- Return structured errors (never panic across boundary)

---

## 4. Data Flow Patterns

### 4.1 Request/Response (User Actions)

```
User Action → React Component → Zustand Action → invoke() → 
    Tauri Command → Rust Handler → Git Service → 
        Result → TypeScript Response → Zustand Update → React Re-render
```

**Example: Stage File**

```typescript
// Frontend
const stageFile = async (path: string) => {
  setOptimisticStaged(path);  // Optimistic update
  try {
    await commands.stageFile({ path });  // tauri-specta typed
  } catch (e) {
    rollbackOptimistic(path);
    showError(e);
  }
};
```

```rust
// Backend
#[tauri::command]
async fn stage_file(
    path: String,
    repo: State<'_, RepositoryContext>,
) -> Result<(), GitError> {
    let repo = repo.lock().await;
    repo.index()?.add_path(Path::new(&path))?;
    repo.index()?.write()?;
    Ok(())
}
```

### 4.2 Event/Channel Flow (Real-Time Updates)

```
File System Change → notify-rs → Rust Handler →
    Channel.send() → Frontend Channel.onmessage() →
        Zustand Sync → React Re-render
```

### 4.3 IPC Primitive Selection

| Primitive | Use Case | Example |
|-----------|----------|---------|
| **Command** | User-initiated actions | Commit, push, checkout |
| **Event** | Broadcast notifications | Settings changed, window focus |
| **Channel** | Streaming data | File watcher, clone progress, status updates |

---

## 5. Gitflow State Machine

### State Machine with statig

```rust
use statig::prelude::*;

#[derive(Default)]
pub struct GitflowMachine {
    current_branch: Option<String>,
    active_feature: Option<String>,
    active_release: Option<String>,
    active_hotfix: Option<String>,
}

#[state_machine(initial = "State::idle()")]
impl GitflowMachine {
    #[state]
    fn idle(&mut self, event: &Event) -> Response<State> {
        match event {
            Event::StartFeature(name) => {
                self.active_feature = Some(name.clone());
                Transition(State::feature_in_progress())
            }
            Event::StartRelease(version) => {
                self.active_release = Some(version.clone());
                Transition(State::release_in_progress())
            }
            Event::StartHotfix(name) => {
                self.active_hotfix = Some(name.clone());
                Transition(State::hotfix_in_progress())
            }
            _ => Handled,
        }
    }

    #[state]
    fn feature_in_progress(&mut self, event: &Event) -> Response<State> {
        match event {
            Event::FinishFeature => {
                // Merge to develop, cleanup
                Transition(State::idle())
            }
            Event::Abort => Transition(State::idle()),
            _ => Handled,
        }
    }

    #[state]
    fn release_in_progress(&mut self, event: &Event) -> Response<State> {
        match event {
            Event::FinishRelease => {
                // Merge to main AND develop
                Transition(State::idle())
            }
            _ => Handled,
        }
    }
}

#[derive(Debug, Clone)]
pub enum Event {
    StartFeature(String),
    FinishFeature,
    StartRelease(String),
    FinishRelease,
    StartHotfix(String),
    FinishHotfix,
    Abort,
}
```

### Policy Enforcement

```rust
#[tauri::command]
async fn start_feature(
    name: String,
    gitflow: State<'_, Mutex<StateMachine<GitflowMachine>>>,
    repo: State<'_, RepositoryContext>,
) -> Result<(), GitflowError> {
    let mut machine = gitflow.lock().await;
    
    // State machine enforces valid transitions
    machine.handle(&Event::StartFeature(name.clone()));
    
    if !matches!(machine.state(), State::FeatureInProgress) {
        return Err(GitflowError::InvalidTransition(
            "Cannot start feature in current state"
        ));
    }
    
    // Execute Git operations only after validation
    let repo = repo.lock().await;
    // ... branch creation logic
    
    Ok(())
}
```

---

## 6. State Synchronization Strategy

```
┌─────────────────────────────────────────────────┐
│              Frontend (Zustand)                 │
│  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   UI State      │  │   Git State Cache   │  │
│  │ (tabs, panels,  │  │ (branches, status,  │  │
│  │  selection)     │  │  commits - cached)  │  │
│  │                 │  │                     │  │
│  │ Source of Truth │  │ Synced from Backend │  │
│  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────┘
                         ▲
                         │ Events/Channels
                         │
┌─────────────────────────────────────────────────┐
│              Backend (Rust)                     │
│  ┌─────────────────────────────────────────┐   │
│  │         Git State (Source of Truth)     │   │
│  │   Repository, branches, commits, index  │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Rules:**
1. **UI state** (panel selection, tabs) lives only in frontend
2. **Git state** is always fetched from backend; frontend caches
3. **Mutations** go through backend; frontend applies optimistic updates
4. **Invalidation** triggered by backend events or user refresh

---

## 7. Suggested Build Order

| Phase | Focus | Dependencies | Deliverable |
|-------|-------|--------------|-------------|
| **1** | Foundation | None | Tauri scaffold, basic IPC, repo context |
| **2** | Core Git | Phase 1 | Stage, commit, status, diff |
| **3** | Real-Time | Phase 2 | File watcher, auto-refresh |
| **4** | Branches | Phase 2 | Branch CRUD, checkout, merge |
| **5** | Gitflow | Phase 4 | State machine, workflow enforcement |
| **6** | Commits | Phase 2 | Conventional commit validation, suggestions |
| **7** | Worktrees | Phase 4 | Worktree panel, create/delete |
| **8** | Topology | Phase 4 | DAG visualization, Gitflow lanes |
| **9** | Polish | All | Performance, keyboard shortcuts, settings |

**Key Dependencies:**
- Gitflow (Phase 5) requires Branches (Phase 4)
- Topology (Phase 8) requires Branches (Phase 4)
- All UI phases require Foundation (Phase 1)

---

## 8. Performance Recommendations

### Large Repository Handling

1. **Disable hash verification** for trusted repos:
   ```rust
   git2::opts::strict_hash_verification(false);
   ```

2. **Use object caching strategically**:
   ```rust
   git2::opts::enable_caching(true);  // For repeated access
   ```

3. **Limit file watcher scope**:
   ```rust
   // Watch .git/HEAD, .git/index, .git/refs - not entire tree
   watcher.watch(repo.path().join("HEAD"), RecursiveMode::NonRecursive)?;
   ```

4. **Debounce rapid events**:
   ```rust
   let debounced = debounce(Duration::from_millis(100));
   ```

5. **Paginate commit history**:
   - Never load all commits at once
   - Use virtual scrolling in frontend
   - Implement incremental loading

---

## 9. Error Handling

```rust
#[derive(Debug, thiserror::Error, Serialize, Type)]
pub enum GitError {
    #[error("Repository not found: {0}")]
    NotFound(String),
    
    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
    
    #[error("Merge conflict in {files:?}")]
    MergeConflict { files: Vec<String> },
    
    #[error("Gitflow violation: {0}")]
    GitflowViolation(String),
}
```

All commands return `Result<T, GitError>` for consistent error handling across IPC boundary.

---

## Quality Gate Verification

- [x] Components clearly defined with boundaries
- [x] Data flow direction explicit (Commands down, Events/Channels up)
- [x] Build order implications noted (dependency chain documented)

---

## Sources

- [Tauri v2 Architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri Inter-Process Communication](https://v2.tauri.app/concept/inter-process-communication/)
- [Tauri State Management](https://v2.tauri.app/develop/state-management/)
- [tauri-specta](https://github.com/specta-rs/tauri-specta)
- [git2-rs](https://github.com/rust-lang/git2-rs)
- [statig - Hierarchical state machines](https://github.com/mdeloof/statig)
- [notify-rs](https://github.com/notify-rs/notify)
