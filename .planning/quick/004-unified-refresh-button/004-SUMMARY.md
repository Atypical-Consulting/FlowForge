# Quick Task 004 Summary

## Task
Replace three individual refresh buttons with one unified refresh button in the Header.

## Outcome
Successfully consolidated refresh functionality into a single button in the Header that refreshes branches, stashes, and tags simultaneously.

## Files Modified/Created
- `src/stores/tags.ts` - NEW: Zustand store for tags state
- `src/components/Header.tsx` - Added unified refresh button
- `src/components/tags/TagList.tsx` - Refactored to use tags store
- `src/components/RepositoryView.tsx` - Removed individual refresh buttons

## Changes Made

### New: src/stores/tags.ts
- Zustand store following same pattern as branches and stash stores
- Manages tags[], isLoading, error state
- Actions: loadTags, deleteTag, clearError

### Header.tsx
- Added RefreshCw icon
- Added hooks to useBranchStore, useStashStore, useTagStore
- Added handleRefreshAll() that calls all three load functions in parallel
- Added refresh button visible when repository is open

### TagList.tsx
- Removed local state (useState for tags, isLoading, error)
- Now uses useTagStore for state management

### RepositoryView.tsx
- Removed RefreshCw import
- Removed useBranchStore and useStashStore hooks
- Removed all refresh buttons from section summaries
- Kept only + (create) buttons

## Commit
`d2fe8f1` - feat(ui): add unified refresh button in Header

## Result
| Section | Before | After |
|---------|--------|-------|
| Branches | Refresh + Create | Create only |
| Stashes | Refresh + Create | Create only |
| Tags | Refresh + Create | Create only |
| Header | - | Unified Refresh |
