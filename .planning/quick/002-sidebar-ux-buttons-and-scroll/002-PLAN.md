# Quick Task 002: Sidebar UX - Buttons and Scroll

## Problem

1. **Action buttons location**: After removing duplicate headers in quick task 001, the refresh/add buttons were inside child components but not visible when sections are collapsed
2. **Scrolling**: The left sidebar had `overflow-hidden` which meant if all sections expanded, the Gitflow section would get cut off

## Solution

1. Move action buttons into the `<summary>` elements in RepositoryView.tsx so they're always visible in the section header
2. Change sidebar from `overflow-hidden` to `overflow-y-auto` so the entire sidebar scrolls
3. Add sticky positioning to section headers for better UX while scrolling

## Tasks

1. **Update RepositoryView.tsx**:
   - Add action buttons (refresh, add/create) directly in each `<summary>` element
   - Change sidebar to `overflow-y-auto`
   - Add sticky headers with `sticky top-0 bg-gray-950 z-10`
   - Manage dialog state for Stash and Tag dialogs

2. **Update StashList.tsx**:
   - Remove internal action buttons
   - Accept `showSaveDialog` and `onCloseSaveDialog` props from parent

3. **Update TagList.tsx**:
   - Remove internal action buttons
   - Accept `showCreateDialog` and `onCloseCreateDialog` props from parent

## Design Decisions

- Buttons use `e.preventDefault()` to prevent `<details>` toggle when clicking
- Icons sized at `w-3.5 h-3.5` to fit in the summary line
- Buttons positioned with `flex-1` on the label text to push buttons to the right
