# Quick Task 003: Remove Duplicate Branches Header

## Problem

BranchList.tsx had the same issue as StashList and TagList - an internal "Branches" header that duplicated the `<details><summary>` header in RepositoryView.tsx.

## Solution

Apply the same pattern used in quick tasks 001 and 002:
1. Remove the internal header from BranchList.tsx
2. Add create branch button (+) to the summary element in RepositoryView.tsx
3. Pass dialog state via props

## Tasks

1. **Update BranchList.tsx**:
   - Remove header div with "Branches" text and action buttons
   - Accept `showCreateDialog` and `onCloseCreateDialog` props
   - Use props for dialog control instead of internal state

2. **Update RepositoryView.tsx**:
   - Add `showBranchDialog` state
   - Add create branch button (+) to Branches section summary
   - Pass props to BranchList
