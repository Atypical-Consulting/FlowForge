# Plan 28-02 Summary: Hook & Component Extraction

## Status: COMPLETE

## What Was Built
- **`src/hooks/useCommitExecution.ts`**: Reusable commit/push mutation hook with React Query invalidation and toast notifications
- **`src/hooks/useAmendPrefill.ts`**: Amend toggle with last commit pre-fill and CC parsing for conventional commit fields
- **`src/components/commit/CommitPreview.tsx`**: Commit message preview with compact (sidebar) and full (blade) variants
- **`src/components/commit/CommitActionBar.tsx`**: Standalone action buttons for commit/push/amend with proper button states
- **`src/components/commit/TypeSelector.tsx`**: Added `columns` prop (4 for sidebar, 6 for blade)
- **Migrated sidebar forms**: `CommitForm.tsx` uses `useCommitExecution` + `useAmendPrefill`; `ConventionalCommitForm.tsx` uses `CommitPreview` + `CommitActionBar`

## Key Files

### Created
- `src/hooks/useCommitExecution.ts` — commit, commitAndPush, push methods
- `src/hooks/useAmendPrefill.ts` — toggleAmend, prefillConventional
- `src/components/commit/CommitPreview.tsx` — compact/full variants
- `src/components/commit/CommitActionBar.tsx` — commit/push/amend buttons

### Modified
- `src/components/commit/TypeSelector.tsx` — columns prop
- `src/components/commit/ConventionalCommitForm.tsx` — uses CommitPreview + CommitActionBar
- `src/components/commit/CommitForm.tsx` — uses useCommitExecution + useAmendPrefill

## Self-Check: PASSED
- [x] Type check clean
- [x] Vite build succeeds
- [x] 87/87 tests pass (all 19 files)
- [x] Sidebar behavior visually and functionally identical
- [x] No duplicate mutation logic in CommitForm.tsx

## Commit
`d66b6da` feat(28-02): extract commit hooks and UI primitives for extensibility
