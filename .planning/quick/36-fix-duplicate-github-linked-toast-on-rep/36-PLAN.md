# Quick Task 36: Fix duplicate GitHub "Linked to" toast on repo open

## Problem
When opening a repository with a GitHub remote, two identical "Linked to github.com/owner/repo" toasts appear.

## Root Cause
React StrictMode double-fires useEffect callbacks in development. The `registerBuiltIn` call in App.tsx runs twice, causing GitHub extension's `onActivate` to execute twice. Each activation calls `detectRemotes()`, producing two toasts.

## Fix
Add a module-level deduplication guard (`lastLinkedToastRepo`) in `githubStore.ts`:
- Track the last repo key that showed the toast
- Skip the toast if the same key was already shown
- Reset the guard when remotes are cleared (repo switch)
