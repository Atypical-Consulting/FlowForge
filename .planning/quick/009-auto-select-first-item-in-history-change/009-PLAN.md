---
phase: quick
plan: 009
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/RepositoryView.tsx
  - src/components/commit/CommitHistory.tsx
  - src/components/staging/StagingPanel.tsx
  - src/stores/staging.ts
autonomous: true

must_haves:
  truths:
    - "When history tab opens, first commit is auto-selected"
    - "When changes tab opens, first file is auto-selected"
    - "Selections persist when switching between tabs"
  artifacts:
    - path: "src/components/RepositoryView.tsx"
      provides: "Persistent selection state across tabs"
    - path: "src/components/commit/CommitHistory.tsx"
      provides: "Auto-select first commit on load"
    - path: "src/components/staging/StagingPanel.tsx"
      provides: "Auto-select first file on load"
  key_links:
    - from: "src/components/commit/CommitHistory.tsx"
      to: "onSelectCommit callback"
      via: "useEffect on data load"
      pattern: "useEffect.*onSelectCommit"
    - from: "src/components/staging/StagingPanel.tsx"
      to: "useStagingStore.selectFile"
      via: "useEffect on data load"
      pattern: "useEffect.*selectFile"
---

<objective>
Auto-select the first item in the History and Changes panels when they load, and persist selections when switching tabs.

Purpose: Improve UX by showing commit details or file diffs immediately without requiring manual selection.
Output: Auto-selection behavior with persistent state across tab switches.
</objective>

<context>
@.planning/STATE.md
@src/components/RepositoryView.tsx
@src/components/commit/CommitHistory.tsx
@src/components/staging/StagingPanel.tsx
@src/stores/staging.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove selection reset on tab switch and add auto-select for history</name>
  <files>src/components/RepositoryView.tsx, src/components/commit/CommitHistory.tsx</files>
  <action>
1. In RepositoryView.tsx:
   - Remove `setSelectedCommit(null)` from the history tab and topology tab onClick handlers (lines 154 and 171)
   - This allows the selected commit to persist when switching tabs

2. In CommitHistory.tsx:
   - Add import for `useEffect` from react
   - Add a useEffect that auto-selects the first commit when:
     a. Data loads and commits array becomes non-empty
     b. No commit is currently selected (selectedOid is null)
   - Call `onSelectCommit(commits[0])` to select first commit

Implementation for CommitHistory.tsx useEffect:
```tsx
useEffect(() => {
  if (commits.length > 0 && !selectedOid) {
    onSelectCommit(commits[0]);
  }
}, [commits, selectedOid, onSelectCommit]);
```
  </action>
  <verify>
1. Run `npm run dev` and open a repository
2. Click on History tab - first commit should be auto-selected and details shown in right panel
3. Switch to Changes tab, then back to History - selection should be preserved
  </verify>
  <done>History panel auto-selects first commit on load and preserves selection across tab switches</done>
</task>

<task type="auto">
  <name>Task 2: Add auto-select for first file in Changes panel</name>
  <files>src/components/staging/StagingPanel.tsx, src/stores/staging.ts</files>
  <action>
1. In StagingPanel.tsx:
   - Add import for `useEffect` from react
   - Get `selectedFile` and `selectFile` from useStagingStore (currently only gets viewMode and setViewMode)
   - Add a useEffect that auto-selects the first file when:
     a. Status data loads with files available
     b. No file is currently selected (selectedFile is null)
   - Priority order for auto-selection: staged[0] > unstaged[0] > untracked[0]
   - Call `selectFile(firstFile, section)` to select

Implementation:
```tsx
const { viewMode, setViewMode, selectedFile, selectFile } = useStagingStore();

useEffect(() => {
  if (!selectedFile && result?.status === "ok") {
    const status = result.data;
    if (status.staged.length > 0) {
      selectFile(status.staged[0], "staged");
    } else if (status.unstaged.length > 0) {
      selectFile(status.unstaged[0], "unstaged");
    } else if (status.untracked.length > 0) {
      selectFile(status.untracked[0], "untracked");
    }
  }
}, [result, selectedFile, selectFile]);
```
  </action>
  <verify>
1. Run `npm run dev` and open a repository with changes
2. Changes tab should have first file auto-selected and diff shown in right panel
3. Switch to History tab, then back to Changes - file selection should be preserved
  </verify>
  <done>Changes panel auto-selects first file on load and preserves selection across tab switches</done>
</task>

</tasks>

<verification>
1. `npm run dev` - App starts without errors
2. Open a repository with commit history and pending changes
3. Default tab (Changes) - first file is auto-selected, diff is visible
4. Switch to History tab - first commit is auto-selected, details are visible
5. Click a different commit - that commit is selected
6. Switch to Changes tab - file selection is preserved
7. Switch back to History tab - commit selection is preserved
8. No console errors related to selection
</verification>

<success_criteria>
- First item auto-selected in History panel when no selection exists
- First item auto-selected in Changes panel when no selection exists
- Selections persist when switching between tabs
- No regression in existing functionality
</success_criteria>

<output>
After completion, create `.planning/quick/009-auto-select-first-item-in-history-change/009-SUMMARY.md`
</output>
