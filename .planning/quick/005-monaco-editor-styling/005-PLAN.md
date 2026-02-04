# Quick Task 005: Monaco Editor Styling

## Problem

The Monaco diff editor was using the default `vs-dark` theme which has a different background color and styling than the app's dark theme (Tailwind gray-950/900/800).

## Solution

Create a custom Monaco theme called `flowforge-dark` that matches the app's color palette:

1. Define custom theme using Monaco's `defineTheme` API
2. Use Tailwind gray colors for backgrounds
3. Use Tailwind color palette for syntax highlighting
4. Style diff additions/deletions with green/red transparency
5. Style scrollbars to match app aesthetic

## Tasks

1. **Create custom theme definition**:
   - Base on `vs-dark` for inheritance
   - Override editor colors to use gray-950 (#030712)
   - Define syntax highlighting rules with Tailwind colors

2. **Apply theme to DiffEditor**:
   - Initialize Monaco loader with custom theme
   - Change theme prop from "vs-dark" to "flowforge-dark"
   - Add scrollbar options for better appearance

## Color Mapping

| Element | Tailwind | Hex |
|---------|----------|-----|
| Background | gray-950 | #030712 |
| Foreground | gray-200 | #e5e7eb |
| Line numbers | gray-500 | #6b7280 |
| Selection | blue-500 | #3b82f6 |
| Added lines | green-500 | #22c55e |
| Removed lines | red-500 | #ef4444 |
