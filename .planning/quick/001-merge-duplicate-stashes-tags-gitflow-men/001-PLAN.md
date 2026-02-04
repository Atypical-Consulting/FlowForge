# Quick Task 001: Merge Duplicate Stashes/Tags/Gitflow Menu Items

## Problem

In the left sidebar menu, "Stashes", "Tags", and "Gitflow" labels appeared twice:
1. Once in the `<details><summary>` element in RepositoryView.tsx
2. Again as an internal header within each component (StashList, TagList, GitflowPanel)

## Solution

Remove the duplicate internal headers from each component while preserving the action buttons (refresh, add/create).

## Tasks

1. **StashList.tsx** - Remove "Stashes" header text but keep refresh/add buttons
2. **TagList.tsx** - Remove "Tags" header text but keep refresh/create buttons  
3. **GitflowPanel.tsx** - Remove "Gitflow" header entirely (component has rich internal content)

## Changes

- `src/components/stash/StashList.tsx` - Removed header with "Stashes" text, simplified action buttons layout
- `src/components/tags/TagList.tsx` - Removed header with "Tags" text, simplified action buttons layout
- `src/components/gitflow/GitflowPanel.tsx` - Removed header section with GitBranch icon and "Gitflow" text
