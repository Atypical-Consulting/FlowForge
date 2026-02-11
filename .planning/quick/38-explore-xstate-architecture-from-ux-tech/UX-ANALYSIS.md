# UX Analysis: XState Architecture for FlowForge

## Executive Summary

This analysis evaluates how adopting XState state machines for five proposed workflows would improve FlowForge's user experience, with particular attention to how the extension system can leverage state machine visibility. The current codebase relies on loose boolean flags, scattered React Query mutations, and manual error handling that create gaps in user feedback, error recovery, and cancellation flows. XState would close these gaps while opening new extensibility patterns.

---

## Machine 1: Merge Workflow (Highest UX Impact)

### Current UX State

**Source files analyzed:**
- `src/components/branches/MergeDialog.tsx` -- Confirmation and result dialog
- `src/stores/domain/git-ops/branches.slice.ts` -- `mergeBranch`, `abortMerge`

**How it works today:**
1. User right-clicks a branch and selects "Merge into current"
2. `MergeDialog` opens with a confirmation ("Merge `feature/x` into current branch?")
3. On confirm, `mergeBranch()` sets `branchMergeInProgress: true` and calls the Tauri backend
4. On success, `branchLastMergeResult` holds the result; `MergeDialog` re-renders to show outcome
5. If conflicts exist, the dialog shows conflicted files and an "Abort Merge" button
6. The user must resolve conflicts externally, then stage and commit

**UX Pain Points:**

| Problem | Impact | Severity |
|---------|--------|----------|
| No "resolving" state -- after seeing conflicts, closing the dialog loses all context | User confusion about what state the repo is in | High |
| `branchMergeInProgress` and `branchLastMergeResult` are independent booleans that can desynchronize | Potential for stale UI showing wrong merge state | High |
| No retry path after merge errors -- user must close dialog and start over | Lost context, repeated navigation | Medium |
| No progress indication during `mergeBranch()` -- only a disabled button with "Merging..." text | Low confidence that operation is proceeding | Medium |
| After successful merge, no prompting to push changes | Missed opportunity for workflow continuation | Low |

### How XState Improves UX

**State visibility eliminates confusion.** With a merge machine, the UI always knows whether the repo is in `idle`, `merging`, `conflicted`, `resolving`, `aborting`, or `error` state. This means:

- The sidebar can show a persistent "Merge in progress" indicator when in `conflicted` or `resolving` states, even after the dialog is closed
- Re-opening the merge context shows exactly where the user left off
- The dialog adapts its layout based on `state.value` -- no conditional rendering based on boolean combinations

**Error recovery becomes a first-class flow.** Instead of closing the dialog on error and restarting:
- `error` state presents "Retry" (go back to `merging`) and "Abort" (go to `aborting` then `idle`)
- The error message persists in `context.error` alongside the original branch names, so retry has full context

**Conflict resolution gains structure.** Today, the user sees "Resolve conflicts manually, then stage and commit" -- there's no tracking of resolution progress. With XState:
- `conflicted` state holds the conflict file list in context
- Transitioning to `resolving` could track which files have been staged
- Extensions could contribute resolution tools (see Extensibility section)

### Extensibility Implications

**Extension-contributed merge strategies.** The GitHub extension already has a `MergeStrategySelector` component (`src/extensions/github/components/MergeStrategySelector.tsx`) with merge/squash/rebase options. With XState:
- Extensions register merge strategy implementations via `onWillGit("merge")`
- The merge machine's `merging` state can invoke different strategy services based on `context.strategy`
- New strategies appear in the UI automatically through registry patterns

**Extension-contributed conflict resolution.** An extension could:
- Subscribe to the merge machine entering `conflicted` state
- Contribute a sidebar panel showing conflict resolution tools
- Register a "Resolve with AI" command that appears only during conflicts
- Track resolution progress via machine context updates

**State change subscriptions.** Extensions already use `onDidGit("merge")` for post-merge hooks. With XState actors exposed via Zustand, extensions could also:
- `actor.subscribe()` to react to any state transition
- Show extension-specific UI only during certain merge phases
- Validate transitions (e.g., prevent commit during unresolved conflicts)

---

## Machine 2: Gitflow Operation Orchestrator (High UX Impact)

### Current UX State

**Source files analyzed:**
- `src/extensions/gitflow/components/FinishFlowDialog.tsx` -- Finish dialog
- `src/extensions/gitflow/components/StartFlowDialog.tsx` -- Start dialog
- `src/stores/domain/git-ops/gitflow.slice.ts` -- All gitflow operations

**How it works today:**
1. GitflowPanel shows action cards for start/finish operations
2. Each operation (e.g., `finishFeature`) runs 3-4 sequential async calls:
   - `commands.finishFeature()` (Tauri backend)
   - `refreshGitflow()` (refresh gitflow status)
   - `loadBranches()` (refresh branch list)
   - `refreshRepoStatus()` (refresh header)
3. The dialog shows a single "Finishing..." loading state for the entire chain
4. Errors show as a red text line: `{error && <p className="text-ctp-red">{error}</p>}`

**UX Pain Points:**

| Problem | Impact | Severity |
|---------|--------|----------|
| If `loadBranches()` fails after a successful finish, the user sees stale branch data with no indication | Silent data staleness | High |
| Single boolean `gitflowIsLoading` covers all operations -- user can't tell which step is happening | Low confidence and no ability to diagnose slow steps | High |
| No rollback or recovery -- if the finish succeeds but UI refresh fails, there's no retry path | User must manually refresh or restart | Medium |
| No prevention of concurrent operations (e.g., starting a release while a feature finish is in progress) | Potential for race conditions | Medium |
| Error display is a single string with no structured information | Hard to decide next steps | Medium |

### How XState Improves UX

**Step-by-step progress.** Instead of one "Finishing..." indicator, the UI shows:
- "Finishing feature..." (executing git operation)
- "Refreshing branches..." (updating branch list)
- "Updating status..." (refreshing repo status)
- Each step can show success/failure independently

**Partial failure recovery.** A compound `refreshing` state can run parallel refreshes:
- If branch refresh fails but gitflow refresh succeeds, enter a `stale` state showing "Branch list may be outdated -- Refresh"
- The user can manually retry just the failed refresh step

**Concurrent operation prevention.** The machine enforces that only one gitflow operation can be active:
- Starting a release while finishing a feature is structurally impossible
- The UI disables action cards when the machine is not in `idle` state
- No boolean-checking required in each component

### Extensibility Implications

**Extension-contributed review steps.** The `ReviewChecklist` component already exists (`src/extensions/gitflow/components/ReviewChecklist.tsx`). With XState:
- Extensions register `onWillGit("merge")` validators that run before finish operations
- A "pre-finish validation" state collects results from all registered validators
- Extensions can contribute checklist items that must be satisfied before proceeding
- CI status checks could block finish operations

**Extension-contributed post-finish actions.** After a feature finish:
- Extensions could register post-finish hooks (e.g., auto-create PR, notify team)
- The machine's `refreshing` state could include extension-contributed refresh actions
- A "post-finish" compound state runs registered cleanup actions in parallel

---

## Machine 3: Clone Progress with Cancellation (Medium UX Impact)

### Current UX State

**Source files analyzed:**
- `src/components/clone/CloneForm.tsx` -- Clone form with mutation
- `src/components/clone/CloneProgress.tsx` -- Progress display

**How it works today:**
1. User enters URL and destination, clicks "Clone"
2. `CloneForm` creates a Tauri `Channel<CloneProgressType>` for streaming progress
3. `CloneProgress` renders phase-specific labels: "Connecting...", "Receiving objects: X/Y", "Resolving deltas", "Checking out files"
4. Framer Motion animates the progress bar
5. On success, auto-opens the cloned repository
6. On error, shows a toast

**UX Pain Points:**

| Problem | Impact | Severity |
|---------|--------|----------|
| No cancel button -- once clone starts, user cannot abort | Stuck waiting for potentially large clones | High |
| If component unmounts during clone, the Tauri Channel stays open | Resource leak, potential background errors | Medium |
| No retry mechanism -- on error, user must re-enter URL and restart | Lost form state | Medium |
| Progress phases (connecting, receiving, resolving, checkout) are handled by a switch statement, not state transitions | Phase transitions aren't tracked, can't show phase summary | Low |

### How XState Improves UX

**Cancellation from any active phase.** The biggest UX win:
- A "Cancel" button appears during all active phases (connecting, receiving, resolving, checkout)
- `CANCEL` event triggers proper channel teardown via `invoke` cleanup
- The UI transitions to a "Cancelled" state with "Retry" option (preserving URL and destination)

**Phase awareness.** Instead of a switch statement mapping progress events to labels:
- Each phase is an explicit state: `connecting`, `receiving`, `resolving`, `checkout`, `complete`
- The UI can show a stepper/timeline of completed phases
- Phase transitions trigger animations naturally

**Component unmount safety.** XState's `invoke` pattern automatically cleans up:
- Stopping the machine (on unmount) runs cleanup functions for active invocations
- The Tauri channel is properly closed, preventing resource leaks

### Extensibility Implications

**Extension-contributed post-clone actions.** After cloning:
- Extensions could register setup actions (e.g., install dependencies, configure hooks)
- The machine could enter a `configuring` state that runs extension-contributed setup
- A ".flowforge" directory could be auto-initialized for the new repo

**Clone source extensions.** Extensions could contribute:
- Alternative clone sources (e.g., clone from GitLab, Bitbucket with specific auth)
- Custom progress phases for their clone implementations
- Pre-clone validation (e.g., check disk space, verify credentials)

---

## Machine 4: Commit + Push Orchestration (Medium UX Impact)

### Current UX State

**Source files analyzed:**
- `src/hooks/useCommitExecution.ts` -- Commit/push mutations + hook bus integration
- `src/components/commit/CommitForm.tsx` -- Commit UI with amend, conventional commits
- `src/lib/gitHookBus.ts` -- Pre/post operation hook system

**How it works today:**
1. User writes commit message, clicks "Commit"
2. `useCommitExecution.commit()` calls `gitHookBus.emitWill("commit")` for extension validation
3. If no extension cancels, `commitMutation.mutateAsync()` runs
4. On success, a toast appears: "Committed: message" with a "Push now" action button
5. Push retry lives in a toast error callback: `onClick: () => pushMutation.mutate()`
6. `commitAndPush()` chains commit then push sequentially

**UX Pain Points:**

| Problem | Impact | Severity |
|---------|--------|----------|
| Push retry is a toast callback -- toasts auto-dismiss, losing the retry option | Lost recovery path | High |
| No visibility into hook validation -- if an extension cancels, user sees "Commit cancelled by extension" with no detail about which extension or why | Opaque failure | Medium |
| Amend commit uses `window.confirm()` -- a browser dialog, not a themed in-app confirmation | Jarring UX inconsistency | Medium |
| `isCommitting` and `isPushing` are separate booleans -- no unified "busy" state prevents double-submit | Potential for concurrent operations | Low |
| After commit, no automatic staging check -- user might commit, push, then realize they forgot files | Missed validation opportunity | Low |

### How XState Improves UX

**Structured validation visibility.** Instead of a generic "cancelled by extension" message:
- `validating` state shows which extensions are checking the commit
- Each validator's result (approve/reject with reason) is shown in the UI
- Users understand exactly what to fix before retrying

**Push retry as a state, not a toast.** The commit form itself shows push status:
- After commit: "Committed. Push to origin?" with push button
- On push failure: "Push failed: reason. [Retry] [Skip]"
- The retry button is always visible, not ephemeral like a toast

**Unified busy state.** The machine prevents:
- Double commits (can only commit from `idle`)
- Commit during push (machine is in `pushing` state)
- Push during commit validation (machine is in `validating` state)

### Extensibility Implications

**Extension-contributed validation steps.** The `gitHookBus` already supports `onWillGit("commit")`. With XState:
- Each registered validator runs as a sub-state in the `validating` compound state
- Extensions can show custom validation UI (e.g., lint results, test status)
- Validation results accumulate in machine context for review
- Extensions can contribute "fix" actions for their validation failures

**Extension-contributed post-commit actions.** Beyond "Push now":
- Extensions register post-commit actions: "Create PR", "Update ticket", "Run tests"
- The `committed` state shows available actions from all extensions
- Each action is its own state transition with proper loading/error handling

**Workflow customization.** Extensions could modify the commit workflow:
- Add a "pre-commit hook" validation step with UI
- Insert a "sign commit" step before the actual commit
- Add a "link to issue" step with auto-detection

---

## Machine 5: Form Dialog State (Lower Priority, High Polish)

### Current UX State

**Source files analyzed:**
- `src/components/branches/CreateBranchDialog.tsx` -- Simple form dialog
- `src/components/stash/StashDialog.tsx` -- Uses Dialog component
- `src/extensions/gitflow/components/StartFlowDialog.tsx` -- With input sanitization
- `src/extensions/github/components/MergeConfirmDialog.tsx` -- Uses Dialog + MergeStrategySelector
- `src/components/ui/dialog.tsx` -- Shared Dialog primitives

**How it works today:**
- Dialogs use either raw `div` overlays (older pattern) or the shared `Dialog` component (newer pattern)
- Each dialog manages its own `useState` for form fields, loading, and error
- Loading state is a single `isLoading` boolean from the relevant store
- Error display is a red text paragraph
- Some dialogs (e.g., `CreateBranchDialog`) use raw divs; others (e.g., `StashDialog`) use the `Dialog` component

**UX Inconsistencies Across Dialogs:**

| Dialog | Uses Dialog component? | Has loading state? | Has error display? | Prevents double submit? |
|--------|----------------------|-------------------|-------------------|----------------------|
| CreateBranchDialog | No (raw div) | Yes (disabled button) | Yes | Yes (disabled) |
| MergeDialog | No (raw div) | Yes (disabled button) | No | Yes (disabled) |
| StashDialog | Yes | Yes (disabled button) | Yes | Yes (disabled) |
| StartFlowDialog | No (raw div) | Yes (disabled button) | Yes | Yes (disabled) |
| FinishFlowDialog | No (raw div) | Yes (disabled button) | Yes | Yes (disabled) |
| MergeConfirmDialog | Yes | Yes (loading prop) | No | Yes (disabled) |

**Common UX Pain Points:**

| Problem | Impact | Severity |
|---------|--------|----------|
| Inconsistent dialog styling -- some use raw divs, others use Dialog component | Visual inconsistency | Medium |
| No validation feedback before submission -- errors only appear after submit fails | Wasted roundtrips | Medium |
| No optimistic UI -- submit always blocks until completion | Perceived slowness | Low |
| No keyboard shortcut consistency across dialogs | Inconsistent interaction model | Low |

### How XState Improves UX

**Consistent state lifecycle.** A reusable dialog machine provides:
- `idle` -> `validating` -> `submitting` -> `success` | `error`
- Every dialog gets the same state transitions, eliminating inconsistency
- The `validating` state runs client-side validation before submission
- The `error` state preserves form data for editing and resubmission

**Double-submit prevention.** Currently handled by disabling buttons via `isLoading`. With XState:
- Submit is only possible from `idle` or `error.editing` states
- State guards are structurally enforced, not conditionally applied

**Optimistic UI and rollback.** For fast operations:
- `submitting` state can show optimistic success immediately
- If the operation fails, rollback to `error` with the original data preserved
- User sees instant feedback with safe fallback

### Extensibility Implications

**Extension-contributed dialog fields.** This is the most speculative but potentially powerful pattern:
- Extensions register additional form fields for specific dialog types
- Example: a "Jira" extension adds an "Issue Key" field to CreateBranchDialog
- The dialog machine's context includes an `extensionFields` map
- Extensions validate their fields during the `validating` state

**Extension-contributed dialog variants.** Extensions could:
- Register new dialog types that use the same dialog machine
- Override default dialogs with enhanced versions (e.g., a "Smart Branch" dialog that suggests names)
- Contribute actions to dialog footers (e.g., "Create and Push" added by an extension)

---

## Cross-Cutting UX Themes

### 1. State Visibility Enables Better Extension UX

The most important cross-cutting insight: **when workflow state is explicit and observable, extensions can contribute context-aware UI**.

Today, extensions can only react to completed operations via `onDidGit()`. With XState:
- Extensions observe intermediate states (validating, merging, resolving conflicts)
- Extensions contribute UI that appears only during relevant states
- Extensions provide recovery actions for error states
- The `ExtensionAPI` gains a `subscribeToWorkflow(machineId)` method

### 2. Error Recovery Transforms from "Restart" to "Resume"

Current pattern: error -> close dialog -> re-navigate -> re-open dialog -> re-enter data.
XState pattern: error -> show error in context -> offer retry/edit/abort from current state.

This reduces the cognitive load of error recovery across all five machines.

### 3. Loading States Become Informative

Current pattern: single "Loading..." or "Working..." indicator.
XState pattern: step-specific labels ("Validating...", "Merging...", "Refreshing branches...") derived from `state.value`.

This builds user confidence that operations are proceeding and helps diagnose slow steps.

### 4. Cancellation Becomes Universal

Currently, only `MergeDialog` offers an "Abort Merge" button, and only after conflicts are detected. With XState:
- Every long-running operation gets a cancel path
- `invoke` cleanup ensures proper resource teardown
- Cancelled operations return to a known-good state

### 5. Extension-Aware Workflow Composition

The most powerful extensibility pattern: **extensions compose into workflows, not just react to events**.

| Current Pattern | XState Pattern |
|----------------|---------------|
| Extension reacts after commit completes | Extension adds validation step before commit |
| Extension shows toast on merge | Extension contributes merge strategy option |
| Extension hooks into post-push | Extension adds "link to issue" step in commit workflow |
| Extension cannot affect clone UI | Extension contributes post-clone setup phase |

---

## Recommended UX Priorities

| Priority | Machine | UX Win | Extensibility Win |
|----------|---------|--------|-------------------|
| 1 | Merge workflow | Conflict resolution tracking, error recovery | Merge strategies, conflict resolution tools |
| 2 | Commit+Push | Validation visibility, push retry in-context | Pre-commit validation UI, post-commit actions |
| 3 | Gitflow operations | Step-by-step progress, partial failure recovery | Pre-finish validation, post-finish automation |
| 4 | Clone progress | Cancellation, phase timeline | Post-clone setup, alternative clone sources |
| 5 | Dialog forms | Consistency, client-side validation | Extension-contributed fields and actions |

The merge workflow and commit+push flow should be prioritized for UX because they are the most frequently used operations where users currently experience the most friction from missing error recovery and opaque state transitions.

---

## Appendix: Extension API Surface Changes

For extensibility, the `ExtensionAPI` class would gain these methods:

```typescript
// Subscribe to workflow state changes
subscribeToWorkflow(
  machineId: "merge" | "gitflow" | "clone" | "commit" | "dialog",
  handler: (state: WorkflowStateEvent) => void
): () => void;

// Contribute a validation step to a workflow
contributeValidation(
  workflow: "merge" | "commit" | "gitflow-finish",
  config: {
    id: string;
    label: string;
    validate: (context: WorkflowContext) => Promise<ValidationResult>;
  }
): void;

// Contribute an action available after a workflow step
contributeWorkflowAction(
  workflow: string,
  afterState: string,
  config: {
    id: string;
    label: string;
    icon: LucideIcon;
    execute: (context: WorkflowContext) => Promise<void>;
  }
): void;
```

These additions follow existing patterns in `ExtensionAPI` (namespacing, cleanup tracking, `onDispose` integration) and would be sandbox-safe since they operate on serializable workflow state.
