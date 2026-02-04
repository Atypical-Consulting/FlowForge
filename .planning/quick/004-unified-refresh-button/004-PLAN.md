# Quick Task 004: Unified Refresh Button in Header

## Problem

Three separate refresh buttons (branches, stashes, tags) in the sidebar section headers was cluttered. User requested a single unified refresh button in the Header.

## Solution

1. Add a single refresh button in Header that calls all three refresh functions
2. Create a tags store for consistent state management (branches and stashes already had stores)
3. Remove individual refresh buttons from sidebar section summaries
4. Keep only the + (create) buttons in each section

## Tasks

1. **Create tags store** (`src/stores/tags.ts`):
   - Zustand store with tags, isLoading, error states
   - loadTags, deleteTag, clearError actions

2. **Update Header.tsx**:
   - Add RefreshCw icon import
   - Add hooks to all three stores
   - Add handleRefreshAll function that calls loadBranches, loadStashes, loadTags in parallel
   - Add refresh button with spinning animation when loading

3. **Update TagList.tsx**:
   - Use new tags store instead of local state

4. **Update RepositoryView.tsx**:
   - Remove refresh buttons from all section summaries
   - Remove unused imports (RefreshCw, cn, store hooks)
   - Keep only + buttons for create actions
