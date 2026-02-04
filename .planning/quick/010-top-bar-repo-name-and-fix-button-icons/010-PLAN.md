---
phase: quick
plan: 010
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/Header.tsx
  - src/components/sync/SyncButtons.tsx
autonomous: true

must_haves:
  truths:
    - "Repository name is visible in the top bar"
    - "Refresh and Fetch buttons have distinct icons"
  artifacts:
    - path: "src/components/Header.tsx"
      provides: "Repository name display"
    - path: "src/components/sync/SyncButtons.tsx"
      provides: "Distinct fetch icon"
  key_links:
    - from: "src/components/Header.tsx"
      to: "status.repoName"
      via: "repository store"
      pattern: "status\\.repoName"
---

<objective>
Display the repository name in the top bar header and differentiate the refresh/fetch button icons.

Purpose: Improve UX by showing which repository is open and making button functions visually distinct.
Output: Updated Header.tsx and SyncButtons.tsx with distinct icons and repo name display.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/Header.tsx
@src/components/sync/SyncButtons.tsx
@src/bindings.ts (RepoStatus type has repoName field)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add repository name to Header</name>
  <files>src/components/Header.tsx</files>
  <action>
    Add repository name display in the Header component:
    1. The `status` object already contains `repoName` (from RepoStatus type in bindings.ts)
    2. Display it between the "FlowForge" app title and the branch badge
    3. Use a subtle separator (e.g., `/` or `>`) and style it with `text-gray-400` for the repo name
    4. Format: "FlowForge / {repoName}" or show repoName in a subtle badge-style element
    
    Suggested markup (after line 54, inside the first flex div):
    ```tsx
    {status && (
      <>
        <span className="text-gray-500">/</span>
        <span className="text-sm text-gray-300">{status.repoName}</span>
      </>
    )}
    ```
  </action>
  <verify>Visual inspection: Open a repository and see the repo name in the top bar</verify>
  <done>Repository name is displayed in the header between app title and branch badge</done>
</task>

<task type="auto">
  <name>Task 2: Change Fetch button icon to CloudDownload</name>
  <files>src/components/sync/SyncButtons.tsx</files>
  <action>
    Update the Fetch button icon to differentiate it from the local Refresh button:
    1. Import `CloudDownload` from "lucide-react" (instead of or in addition to RefreshCw)
    2. Replace `RefreshCw` on line 83 with `CloudDownload`
    3. The icon semantic: CloudDownload represents "fetch from remote" vs RefreshCw represents "refresh local data"
    
    Change import:
    ```tsx
    import { ArrowDown, ArrowUp, CloudDownload, Loader2 } from "lucide-react";
    ```
    
    Change the fetch button icon (line 83):
    ```tsx
    <CloudDownload className="w-4 h-4" />
    ```
    
    This creates clear visual distinction:
    - Header RefreshCw: Refresh local data (branches, stashes, tags)
    - SyncButtons CloudDownload: Fetch from remote
    - SyncButtons ArrowDown: Pull from remote
    - SyncButtons ArrowUp: Push to remote
  </action>
  <verify>Visual inspection: The fetch button now shows a cloud download icon instead of a circular refresh arrow</verify>
  <done>Fetch button has CloudDownload icon, distinct from local Refresh button's RefreshCw icon</done>
</task>

</tasks>

<verification>
1. Open a repository in the app
2. Verify the repository name appears in the top bar (between "FlowForge" and branch badge)
3. Verify the refresh button (in Header) shows a circular arrow icon (RefreshCw)
4. Verify the fetch button (in SyncButtons) shows a cloud download icon (CloudDownload)
5. Both buttons should still function correctly
</verification>

<success_criteria>
- Repository name visible in top bar when a repo is open
- Refresh and Fetch buttons have visually distinct icons
- All sync operations (fetch, pull, push) still work correctly
</success_criteria>

<output>
After completion, create `.planning/quick/010-top-bar-repo-name-and-fix-button-icons/010-SUMMARY.md`
</output>
