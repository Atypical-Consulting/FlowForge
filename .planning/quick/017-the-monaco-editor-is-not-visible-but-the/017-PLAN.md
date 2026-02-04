---
phase: quick
plan: 017
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/RepositoryView.tsx
autonomous: true

must_haves:
  truths:
    - "Monaco DiffEditor is visible when a file is selected"
    - "Editor fills available space in the right panel"
    - "Editor resizes properly when panels are adjusted"
  artifacts:
    - path: "src/components/RepositoryView.tsx"
      provides: "Flex container for FileViewer"
      contains: "flex"
  key_links:
    - from: "RepositoryView.tsx"
      to: "FileViewer > DiffViewer"
      via: "flex container with h-full"
      pattern: "flex.*h-full"
---

<objective>
Fix Monaco DiffEditor visibility issue where the editor container has zero height because the parent element is not a flex container.

Purpose: The Monaco editor is rendered but invisible because DiffViewer uses `flex-1` for sizing, which only works inside a flex container. The parent `<div className="h-full bg-ctp-mantle">` in RepositoryView is not a flex container.

Output: Visible, properly-sized Monaco DiffEditor in the right panel.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/RepositoryView.tsx
@src/components/viewers/DiffViewer.tsx
@src/components/viewers/FileViewer.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add flex container for FileViewer in RepositoryView</name>
  <files>src/components/RepositoryView.tsx</files>
  <action>
In RepositoryView.tsx, find the right panel section (around line 212-215):

```tsx
<ResizablePanel defaultSize={55}>
  <div className="h-full bg-ctp-mantle">
    {activeTab === "changes" ? (
      <FileViewer />
```

Change the container div to be a flex container so that DiffViewer's `flex-1` works properly:

```tsx
<ResizablePanel defaultSize={55}>
  <div className="h-full bg-ctp-mantle flex flex-col">
    {activeTab === "changes" ? (
      <FileViewer />
```

The key change is adding `flex flex-col` to the div that wraps FileViewer. This establishes a flex context that allows DiffViewer's `flex-1` to calculate height correctly.

Note: The topology and commit details views already work because they have their own height constraints (explicit h-full or fixed widths). Only FileViewer needs the flex parent because DiffViewer relies on flex-1.
  </action>
  <verify>
1. Run `npm run dev` and open the app
2. Open a repository with changed files
3. Select a file in the staging panel
4. Verify the Monaco DiffEditor is now visible and shows the diff
5. Resize the panels and verify the editor resizes accordingly
  </verify>
  <done>Monaco DiffEditor is visible, fills available space, and resizes properly with panel adjustments</done>
</task>

</tasks>

<verification>
- App builds without errors: `npm run build`
- Monaco editor visible when file selected
- Editor fills right panel height
- Editor resizes when panels are adjusted
</verification>

<success_criteria>
- Monaco DiffEditor displays file diffs correctly
- No console errors related to Monaco
- Editor responsive to panel resize
</success_criteria>

<output>
After completion, create `.planning/quick/017-the-monaco-editor-is-not-visible-but-the/017-SUMMARY.md`
</output>
