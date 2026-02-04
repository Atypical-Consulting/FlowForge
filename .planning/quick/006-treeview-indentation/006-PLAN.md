# Quick Task 006: Fix File Tree View Indentation

## Problem

In the staging panel's file tree view, files inside folders were not indented to match their folder's depth. Folders showed proper indentation but files at the same level appeared flush left.

## Root Cause

The `FileTreeView` component passes `depth` to render folders with proper indentation, but `FileItem` didn't accept a depth prop, so files were rendered without any indentation.

## Solution

1. Add `depth` prop to `FileItem` component
2. Add `showFilenameOnly` prop to display just the filename (not full path) in tree view
3. Apply paddingLeft style based on depth
4. Update `FileTreeView` to pass both props to `FileItem`

## Tasks

1. **Update FileItem.tsx**:
   - Add `depth?: number` prop (default 0)
   - Add `showFilenameOnly?: boolean` prop (default false)
   - Calculate `displayName` - just filename when `showFilenameOnly` is true
   - Apply inline style `paddingLeft: ${depth * 12 + 12}px` when depth > 0

2. **Update FileTreeView.tsx**:
   - Pass `depth={depth}` to FileItem
   - Pass `showFilenameOnly` to FileItem
