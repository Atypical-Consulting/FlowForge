# Summary: 07-04 Create/Delete dialogs + integration

## Execution

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create CreateWorktreeDialog component | 1a6b2b6 | CreateWorktreeDialog.tsx, index.ts |
| 2 | Create DeleteWorktreeDialog component | 1a6b2b6 | DeleteWorktreeDialog.tsx |
| 3 | Wire dialogs into RepositoryView | 1a6b2b6 | RepositoryView.tsx |

## Deliverables

- **src/components/worktree/CreateWorktreeDialog.tsx**: Worktree creation dialog
  - Name input with auto-fill from directory name
  - Directory picker using @tauri-apps/plugin-dialog
  - Branch selection: existing branch dropdown or create new branch checkbox
  - Loads branches on open for dropdown
  - Error display and loading states

- **src/components/worktree/DeleteWorktreeDialog.tsx**: Worktree deletion confirmation
  - Warning display for dirty/conflicts worktrees
  - Force delete checkbox (required for dirty worktrees)
  - Delete branch option (disabled if not fully merged)
  - Path display for clarity
  - Error display and loading states

- **src/components/RepositoryView.tsx**: Dialog integration
  - Wrapped in fragment to include dialogs after layout
  - CreateWorktreeDialog tied to showWorktreeDialog state
  - DeleteWorktreeDialog tied to worktreeToDelete state

## Technical Notes

- Used lowercase status values (`dirty`, `conflicts`) to match serde serialization
- Directory picker uses `open({ directory: true })` from @tauri-apps/plugin-dialog
- Delete button disabled when isDirty && !forceDelete for protection
- Branch deletion option uses isMerged from branch store to determine eligibility

## Deviations

None - implemented as planned.

## Requirements Completed

- WORK-04: User can create a new worktree from any branch ✓
- WORK-05: User can specify worktree directory location ✓
- WORK-06: User can delete a worktree with cleanup confirmation ✓
- WORK-07: Deleting a worktree offers to delete the linked branch if fully merged ✓
