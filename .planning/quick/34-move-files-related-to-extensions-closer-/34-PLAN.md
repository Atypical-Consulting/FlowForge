---
phase: quick-34
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Gitflow extension
  - src/extensions/gitflow/index.ts
  - src/extensions/gitflow/blades/GitflowCheatsheetBlade.tsx
  - src/extensions/gitflow/blades/GitflowCheatsheetBlade.test.tsx
  - src/extensions/gitflow/components/GitflowPanel.tsx
  - src/extensions/gitflow/components/GitflowDiagram.tsx
  - src/extensions/gitflow/components/InitGitflowDialog.tsx
  - src/extensions/gitflow/components/StartFlowDialog.tsx
  - src/extensions/gitflow/components/FinishFlowDialog.tsx
  - src/extensions/gitflow/components/GitflowActionCards.tsx
  - src/extensions/gitflow/components/GitflowBranchReference.tsx
  - src/extensions/gitflow/components/ReviewChecklist.tsx
  - src/extensions/gitflow/components/index.ts
  # Content-viewers extension
  - src/extensions/content-viewers/index.ts
  - src/extensions/content-viewers/blades/ViewerMarkdownBlade.tsx
  - src/extensions/content-viewers/blades/ViewerMarkdownBlade.test.tsx
  - src/extensions/content-viewers/blades/ViewerCodeBlade.tsx
  - src/extensions/content-viewers/blades/ViewerCodeBlade.test.tsx
  - src/extensions/content-viewers/blades/Viewer3dBlade.tsx
  - src/extensions/content-viewers/blades/Viewer3dBlade.test.tsx
  # Conventional-commits extension
  - src/extensions/conventional-commits/index.ts
  - src/extensions/conventional-commits/blades/conventional-commit/ConventionalCommitBlade.tsx
  - src/extensions/conventional-commits/blades/conventional-commit/index.ts
  - src/extensions/conventional-commits/blades/conventional-commit/hooks/useBladeFormGuard.ts
  - src/extensions/conventional-commits/blades/changelog/ChangelogBlade.tsx
  - src/extensions/conventional-commits/blades/changelog/ChangelogBlade.test.tsx
  - src/extensions/conventional-commits/blades/changelog/index.ts
  - src/extensions/conventional-commits/blades/changelog/store.ts
  - src/extensions/conventional-commits/blades/changelog/components/ChangelogPreview.tsx
  - src/extensions/conventional-commits/components/TypeSelector.tsx
  - src/extensions/conventional-commits/components/ScopeAutocomplete.tsx
  - src/extensions/conventional-commits/components/BreakingChangeSection.tsx
  - src/extensions/conventional-commits/components/CharacterProgress.tsx
  - src/extensions/conventional-commits/components/ValidationErrors.tsx
  - src/extensions/conventional-commits/components/CommitPreview.tsx
  - src/extensions/conventional-commits/components/CommitActionBar.tsx
  - src/extensions/conventional-commits/components/TemplateSelector.tsx
  - src/extensions/conventional-commits/components/ScopeFrequencyChart.tsx
  - src/extensions/conventional-commits/components/ConventionalCommitForm.tsx
  - src/extensions/conventional-commits/components/index.ts
  - src/extensions/conventional-commits/components/__tests__/CommitForm.test.tsx
  # Core files that keep shared commit components
  - src/components/commit/index.ts
autonomous: true
must_haves:
  truths:
    - "Gitflow extension is fully self-contained under src/extensions/gitflow/ with blades/ and components/ subdirectories"
    - "Content-viewers extension is fully self-contained under src/extensions/content-viewers/ with blades/ subdirectory"
    - "Conventional-commits extension is fully self-contained under src/extensions/conventional-commits/ with blades/ and components/ subdirectories"
    - "Shared commit components (CommitForm, CommitHistory, CommitDetails, CommitSearch) remain in src/components/commit/ for core consumers"
    - "All tests pass after reorganization"
    - "TypeScript compilation succeeds with no new errors"
  artifacts:
    - path: "src/extensions/gitflow/components/GitflowPanel.tsx"
      provides: "Gitflow sidebar panel component"
    - path: "src/extensions/gitflow/blades/GitflowCheatsheetBlade.tsx"
      provides: "Gitflow cheatsheet blade"
    - path: "src/extensions/content-viewers/blades/ViewerMarkdownBlade.tsx"
      provides: "Markdown viewer blade"
    - path: "src/extensions/content-viewers/blades/ViewerCodeBlade.tsx"
      provides: "Code viewer blade"
    - path: "src/extensions/content-viewers/blades/Viewer3dBlade.tsx"
      provides: "3D model viewer blade"
    - path: "src/extensions/conventional-commits/blades/conventional-commit/ConventionalCommitBlade.tsx"
      provides: "CC composer blade"
    - path: "src/extensions/conventional-commits/blades/changelog/ChangelogBlade.tsx"
      provides: "Changelog blade"
    - path: "src/extensions/conventional-commits/components/TypeSelector.tsx"
      provides: "CC type selector"
  key_links:
    - from: "src/extensions/gitflow/index.ts"
      to: "./components"
      via: "relative import to self-contained components"
      pattern: "from [\"']\\./components"
    - from: "src/extensions/content-viewers/index.ts"
      to: "./blades"
      via: "relative import to self-contained blades"
      pattern: "from [\"']\\./blades"
    - from: "src/extensions/conventional-commits/index.ts"
      to: "./blades"
      via: "relative import to self-contained blades"
      pattern: "from [\"']\\./blades"
---

<objective>
Move extension-specific files (blades, components) into their respective extension directories to make gitflow, content-viewers, and conventional-commits extensions self-contained -- matching the established pattern from the GitHub extension.

Purpose: Currently only the GitHub extension is self-contained. The other 3 extensions have just an index.ts and reference scattered files across src/blades/ and src/components/. This reorganization makes each extension a coherent, self-contained unit.

Output: All 4 extensions follow the same self-contained directory pattern with blades/ and components/ subdirectories.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/extensions/gitflow/index.ts
@src/extensions/content-viewers/index.ts
@src/extensions/conventional-commits/index.ts
@src/extensions/github/index.ts (reference pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move gitflow and content-viewers extension files</name>
  <files>
    src/extensions/gitflow/index.ts
    src/extensions/gitflow/blades/GitflowCheatsheetBlade.tsx
    src/extensions/gitflow/blades/GitflowCheatsheetBlade.test.tsx
    src/extensions/gitflow/components/GitflowPanel.tsx
    src/extensions/gitflow/components/GitflowDiagram.tsx
    src/extensions/gitflow/components/InitGitflowDialog.tsx
    src/extensions/gitflow/components/StartFlowDialog.tsx
    src/extensions/gitflow/components/FinishFlowDialog.tsx
    src/extensions/gitflow/components/GitflowActionCards.tsx
    src/extensions/gitflow/components/GitflowBranchReference.tsx
    src/extensions/gitflow/components/ReviewChecklist.tsx
    src/extensions/gitflow/components/index.ts
    src/extensions/content-viewers/index.ts
    src/extensions/content-viewers/blades/ViewerMarkdownBlade.tsx
    src/extensions/content-viewers/blades/ViewerMarkdownBlade.test.tsx
    src/extensions/content-viewers/blades/ViewerCodeBlade.tsx
    src/extensions/content-viewers/blades/ViewerCodeBlade.test.tsx
    src/extensions/content-viewers/blades/Viewer3dBlade.tsx
    src/extensions/content-viewers/blades/Viewer3dBlade.test.tsx
  </files>
  <action>
    **GITFLOW EXTENSION** -- Move files into src/extensions/gitflow/:

    1. Create directories: `src/extensions/gitflow/blades/` and `src/extensions/gitflow/components/`

    2. Move blade files:
       - `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` -> `src/extensions/gitflow/blades/GitflowCheatsheetBlade.tsx`
       - `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.test.tsx` -> `src/extensions/gitflow/blades/GitflowCheatsheetBlade.test.tsx`

    3. Move component files (ALL of src/components/gitflow/):
       - `src/components/gitflow/GitflowPanel.tsx` -> `src/extensions/gitflow/components/GitflowPanel.tsx`
       - `src/components/gitflow/GitflowDiagram.tsx` -> `src/extensions/gitflow/components/GitflowDiagram.tsx`
       - `src/components/gitflow/InitGitflowDialog.tsx` -> `src/extensions/gitflow/components/InitGitflowDialog.tsx`
       - `src/components/gitflow/StartFlowDialog.tsx` -> `src/extensions/gitflow/components/StartFlowDialog.tsx`
       - `src/components/gitflow/FinishFlowDialog.tsx` -> `src/extensions/gitflow/components/FinishFlowDialog.tsx`
       - `src/components/gitflow/GitflowActionCards.tsx` -> `src/extensions/gitflow/components/GitflowActionCards.tsx`
       - `src/components/gitflow/GitflowBranchReference.tsx` -> `src/extensions/gitflow/components/GitflowBranchReference.tsx`
       - `src/components/gitflow/ReviewChecklist.tsx` -> `src/extensions/gitflow/components/ReviewChecklist.tsx`
       - `src/components/gitflow/index.ts` -> `src/extensions/gitflow/components/index.ts`

    4. Update ALL import paths in moved files. The new base is `src/extensions/gitflow/` so:
       - `../../stores/domain/git-ops` becomes `../../../stores/domain/git-ops` (3 levels up from components/, 2 from extension root)
       - `../../lib/branchClassifier` becomes `../../../lib/branchClassifier`
       - `../../lib/utils` becomes `../../../lib/utils`
       - `../../hooks/useBladeNavigation` becomes `../../../hooks/useBladeNavigation`
       - `../../stores/toast` becomes `../../../stores/toast`
       - `../../bindings` becomes `../../../bindings`
       - `../../test-utils/render` becomes `../../../test-utils/render`
       - In GitflowCheatsheetBlade.tsx: `../../components/gitflow/GitflowDiagram` becomes `../components/GitflowDiagram` (relative within extension)
       - In GitflowCheatsheetBlade.tsx: `../../components/gitflow/GitflowActionCards` becomes `../components/GitflowActionCards`
       - In GitflowCheatsheetBlade.tsx: `../../components/gitflow/GitflowBranchReference` becomes `../components/GitflowBranchReference`
       - `../../stores/domain/preferences/review-checklist.slice` becomes `../../../stores/domain/preferences/review-checklist.slice`
       - `../../stores/domain/preferences` becomes `../../../stores/domain/preferences`
       - For components in blades/: `../../lib/branchClassifier` becomes `../../../lib/branchClassifier`
       - For components in components/: `../../lib/branchClassifier` becomes `../../../lib/branchClassifier`
       - Internal refs like `./ReviewChecklist`, `./FinishFlowDialog`, `./InitGitflowDialog`, `./StartFlowDialog` stay the same (relative within components/)
       - In test file: mock paths for `../../stores/domain/git-ops` become `../../../stores/domain/git-ops`, etc.

    5. Update `src/extensions/gitflow/index.ts`:
       - `../../components/gitflow` becomes `./components` (or `./components/index`)
       - `../../blades/gitflow-cheatsheet/GitflowCheatsheetBlade` becomes `./blades/GitflowCheatsheetBlade`
       - Keep `../../lib/bladeOpener` and `../../stores/domain/git-ops` as `../../lib/bladeOpener` and `../../stores/domain/git-ops` (these are CORRECT -- index.ts is at src/extensions/gitflow/ which is 2 levels from src/)

    6. Delete old directories after move:
       - Remove `src/blades/gitflow-cheatsheet/` (should be empty)
       - Remove `src/components/gitflow/` (should be empty)

    **CONTENT-VIEWERS EXTENSION** -- Move files into src/extensions/content-viewers/:

    1. Create directory: `src/extensions/content-viewers/blades/`

    2. Move blade files (flatten -- remove per-viewer subdirectories, each viewer is just one component + test):
       - `src/blades/viewer-markdown/ViewerMarkdownBlade.tsx` -> `src/extensions/content-viewers/blades/ViewerMarkdownBlade.tsx`
       - `src/blades/viewer-markdown/ViewerMarkdownBlade.test.tsx` -> `src/extensions/content-viewers/blades/ViewerMarkdownBlade.test.tsx`
       - `src/blades/viewer-code/ViewerCodeBlade.tsx` -> `src/extensions/content-viewers/blades/ViewerCodeBlade.tsx`
       - `src/blades/viewer-code/ViewerCodeBlade.test.tsx` -> `src/extensions/content-viewers/blades/ViewerCodeBlade.test.tsx`
       - `src/blades/viewer-3d/Viewer3dBlade.tsx` -> `src/extensions/content-viewers/blades/Viewer3dBlade.tsx`
       - `src/blades/viewer-3d/Viewer3dBlade.test.tsx` -> `src/extensions/content-viewers/blades/Viewer3dBlade.test.tsx`
       - DO NOT move the old index.ts barrel files from viewer-markdown/index.ts, viewer-code/index.ts, viewer-3d/index.ts -- they are tiny re-exports not needed since extension index.ts uses direct imports

    3. Update ALL import paths in moved blade files. New base is `src/extensions/content-viewers/blades/`:
       - `../../hooks/useRepoFile` becomes `../../../hooks/useRepoFile`
       - `../../../hooks/useRepoFile` stays `../../../hooks/useRepoFile` (already correct depth for blades/)
       - `../_shared/BladeContentLoading` becomes `../../../blades/_shared/BladeContentLoading` (shared blade utilities stay in core)
       - `../_shared/BladeContentError` becomes `../../../blades/_shared/BladeContentError`
       - `../_shared/BladeContentEmpty` becomes `../../../blades/_shared/BladeContentEmpty`
       - `../../components/markdown/MarkdownRenderer` becomes `../../../components/markdown/MarkdownRenderer`
       - `../../lib/monacoConfig` becomes `../../../lib/monacoConfig`
       - `../../lib/monacoTheme` becomes `../../../lib/monacoTheme`
       - `../../bindings` becomes `../../../bindings`
       - `../../lib/errors` becomes `../../../lib/errors`
       - `../../test-utils/render` becomes `../../../test-utils/render`

    4. Update `src/extensions/content-viewers/index.ts`:
       - `../../blades/viewer-markdown/ViewerMarkdownBlade` becomes `./blades/ViewerMarkdownBlade`
       - `../../blades/viewer-code/ViewerCodeBlade` becomes `./blades/ViewerCodeBlade`
       - `../../blades/viewer-3d/Viewer3dBlade` becomes `./blades/Viewer3dBlade`
       - Keep `../../lib/bladeUtils` as-is (correct depth for extension index)

    5. Delete old directories after move:
       - Remove `src/blades/viewer-markdown/` (should be empty or only has unused index.ts)
       - Remove `src/blades/viewer-code/` (should be empty or only has unused index.ts)
       - Remove `src/blades/viewer-3d/` (should be empty or only has unused index.ts)

    7. Run verification: `npx tsc --noEmit 2>&1 | grep -v "TS2440"` and `npx vitest run --reporter=verbose 2>&1 | tail -20`

    8. Commit: `refactor: move gitflow and content-viewers files into self-contained extension directories`
  </action>
  <verify>
    Run `npx tsc --noEmit 2>&1 | grep -v "TS2440"` -- should show no new errors.
    Run `npx vitest run` -- all tests pass (including moved test files).
    Verify old directories are gone: `ls src/blades/gitflow-cheatsheet/ src/components/gitflow/ src/blades/viewer-markdown/ src/blades/viewer-code/ src/blades/viewer-3d/` should all fail with "No such file or directory".
    Verify new structure: `find src/extensions/gitflow -type f | sort` and `find src/extensions/content-viewers -type f | sort` show all expected files.
  </verify>
  <done>
    Gitflow extension directory contains blades/ and components/ subdirectories with all gitflow-specific files.
    Content-viewers extension directory contains blades/ subdirectory with all 3 viewer blade files.
    No files remain in src/blades/gitflow-cheatsheet/, src/components/gitflow/, src/blades/viewer-markdown/, src/blades/viewer-code/, src/blades/viewer-3d/.
    TypeScript compiles and all tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Move conventional-commits extension files</name>
  <files>
    src/extensions/conventional-commits/index.ts
    src/extensions/conventional-commits/blades/conventional-commit/ConventionalCommitBlade.tsx
    src/extensions/conventional-commits/blades/conventional-commit/index.ts
    src/extensions/conventional-commits/blades/conventional-commit/hooks/useBladeFormGuard.ts
    src/extensions/conventional-commits/blades/changelog/ChangelogBlade.tsx
    src/extensions/conventional-commits/blades/changelog/ChangelogBlade.test.tsx
    src/extensions/conventional-commits/blades/changelog/index.ts
    src/extensions/conventional-commits/blades/changelog/store.ts
    src/extensions/conventional-commits/blades/changelog/components/ChangelogPreview.tsx
    src/extensions/conventional-commits/components/TypeSelector.tsx
    src/extensions/conventional-commits/components/ScopeAutocomplete.tsx
    src/extensions/conventional-commits/components/BreakingChangeSection.tsx
    src/extensions/conventional-commits/components/CharacterProgress.tsx
    src/extensions/conventional-commits/components/ValidationErrors.tsx
    src/extensions/conventional-commits/components/CommitPreview.tsx
    src/extensions/conventional-commits/components/CommitActionBar.tsx
    src/extensions/conventional-commits/components/TemplateSelector.tsx
    src/extensions/conventional-commits/components/ScopeFrequencyChart.tsx
    src/extensions/conventional-commits/components/ConventionalCommitForm.tsx
    src/extensions/conventional-commits/components/index.ts
    src/extensions/conventional-commits/components/__tests__/CommitForm.test.tsx
    src/components/commit/index.ts
  </files>
  <action>
    **IMPORTANT: Shared components STAY in core.** The following files remain in `src/components/commit/` because they are used by core blades/components (RepositoryView, TopologyRootBlade):
    - `CommitForm.tsx` (used by RepositoryView.tsx)
    - `CommitHistory.tsx` (used by TopologyRootBlade.tsx)
    - `CommitDetails.tsx` (used by TopologyRootBlade.tsx)
    - `CommitSearch.tsx` (used by CommitHistory.tsx)

    **MOVE CC-only components** into `src/extensions/conventional-commits/components/`:

    1. Create directories:
       - `src/extensions/conventional-commits/blades/conventional-commit/hooks/`
       - `src/extensions/conventional-commits/blades/changelog/components/`
       - `src/extensions/conventional-commits/components/__tests__/`

    2. Move blade files (preserve subdirectory structure as these are complex blades):
       - `src/blades/conventional-commit/ConventionalCommitBlade.tsx` -> `src/extensions/conventional-commits/blades/conventional-commit/ConventionalCommitBlade.tsx`
       - `src/blades/conventional-commit/index.ts` -> `src/extensions/conventional-commits/blades/conventional-commit/index.ts`
       - `src/blades/conventional-commit/hooks/useBladeFormGuard.ts` -> `src/extensions/conventional-commits/blades/conventional-commit/hooks/useBladeFormGuard.ts`
       - `src/blades/changelog/ChangelogBlade.tsx` -> `src/extensions/conventional-commits/blades/changelog/ChangelogBlade.tsx`
       - `src/blades/changelog/ChangelogBlade.test.tsx` -> `src/extensions/conventional-commits/blades/changelog/ChangelogBlade.test.tsx`
       - `src/blades/changelog/index.ts` -> `src/extensions/conventional-commits/blades/changelog/index.ts`
       - `src/blades/changelog/store.ts` -> `src/extensions/conventional-commits/blades/changelog/store.ts`
       - `src/blades/changelog/components/ChangelogPreview.tsx` -> `src/extensions/conventional-commits/blades/changelog/components/ChangelogPreview.tsx`

    3. Move CC-only component files:
       - `src/components/commit/TypeSelector.tsx` -> `src/extensions/conventional-commits/components/TypeSelector.tsx`
       - `src/components/commit/ScopeAutocomplete.tsx` -> `src/extensions/conventional-commits/components/ScopeAutocomplete.tsx`
       - `src/components/commit/BreakingChangeSection.tsx` -> `src/extensions/conventional-commits/components/BreakingChangeSection.tsx`
       - `src/components/commit/CharacterProgress.tsx` -> `src/extensions/conventional-commits/components/CharacterProgress.tsx`
       - `src/components/commit/ValidationErrors.tsx` -> `src/extensions/conventional-commits/components/ValidationErrors.tsx`
       - `src/components/commit/CommitPreview.tsx` -> `src/extensions/conventional-commits/components/CommitPreview.tsx`
       - `src/components/commit/CommitActionBar.tsx` -> `src/extensions/conventional-commits/components/CommitActionBar.tsx`
       - `src/components/commit/TemplateSelector.tsx` -> `src/extensions/conventional-commits/components/TemplateSelector.tsx`
       - `src/components/commit/ScopeFrequencyChart.tsx` -> `src/extensions/conventional-commits/components/ScopeFrequencyChart.tsx`
       - `src/components/commit/ConventionalCommitForm.tsx` -> `src/extensions/conventional-commits/components/ConventionalCommitForm.tsx`
       - `src/components/commit/__tests__/CommitForm.test.tsx` -> `src/extensions/conventional-commits/components/__tests__/CommitForm.test.tsx`

    4. Update import paths in moved blade files. New base is `src/extensions/conventional-commits/blades/`:

       **ConventionalCommitBlade.tsx** (at blades/conventional-commit/):
       - `../../hooks/useConventionalCommit` -> `../../../../hooks/useConventionalCommit`
       - `../../hooks/useCommitExecution` -> `../../../../hooks/useCommitExecution`
       - `../../hooks/useAmendPrefill` -> `../../../../hooks/useAmendPrefill`
       - `./hooks/useBladeFormGuard` stays `./hooks/useBladeFormGuard` (relative within blade)
       - `../../stores/conventional` -> `../../../../stores/conventional`
       - `../../hooks/useBladeNavigation` -> `../../../../hooks/useBladeNavigation`
       - `../../components/layout/SplitPaneLayout` -> `../../../../components/layout/SplitPaneLayout`
       - `../../components/commit/TypeSelector` -> `../../components/TypeSelector` (relative to extension components/)
       - `../../components/commit/ScopeAutocomplete` -> `../../components/ScopeAutocomplete`
       - `../../components/commit/BreakingChangeSection` -> `../../components/BreakingChangeSection`
       - `../../components/commit/CharacterProgress` -> `../../components/CharacterProgress`
       - `../../components/commit/ValidationErrors` -> `../../components/ValidationErrors`
       - `../../components/commit/CommitPreview` -> `../../components/CommitPreview`
       - `../../components/commit/CommitActionBar` -> `../../components/CommitActionBar`
       - `../../components/commit/TemplateSelector` -> `../../components/TemplateSelector`
       - `../../components/commit/ScopeFrequencyChart` -> `../../components/ScopeFrequencyChart`
       - `../../lib/utils` -> `../../../../lib/utils`

       **useBladeFormGuard.ts** (at blades/conventional-commit/hooks/):
       - `../../../machines/navigation/context` -> `../../../../../machines/navigation/context`

       **ChangelogBlade.tsx** (at blades/changelog/):
       - `../../lib/utils` -> `../../../../lib/utils`
       - `../../hooks/useBladeNavigation` -> `../../../../hooks/useBladeNavigation`
       - `../../components/ui/button` -> `../../../../components/ui/button`
       - `./store` stays `./store`
       - `./components/ChangelogPreview` stays `./components/ChangelogPreview`

       **ChangelogBlade.test.tsx** (at blades/changelog/):
       - `../../test-utils/render` -> `../../../../test-utils/render`

       **store.ts** (at blades/changelog/):
       - `../../bindings` -> `../../../../bindings`
       - `../../stores/createBladeStore` -> `../../../../stores/createBladeStore`

       **ChangelogPreview.tsx** (at blades/changelog/components/):
       - `../../../lib/commit-type-theme` -> `../../../../../lib/commit-type-theme`
       - `../../../lib/utils` -> `../../../../../lib/utils`
       - `../../../components/icons/CommitTypeIcon` -> `../../../../../components/icons/CommitTypeIcon`
       - `../store` stays `../store`

    5. Update import paths in moved component files. New base is `src/extensions/conventional-commits/components/`:
       - All components that import from `../../hooks/*` -> `../../../hooks/*`
       - All components that import from `../../stores/*` -> `../../../stores/*`
       - All components that import from `../../lib/*` -> `../../../lib/*`
       - All components that import from `../../bindings` -> `../../../bindings`
       - All components that import from `../../components/*` -> `../../../components/*`
       - Internal component refs (e.g., `./CommitSearch` within CommitHistory if present) stay the same
       - The test file at `__tests__/CommitForm.test.tsx`:
         - `../../../test-utils/render` -> `../../../../test-utils/render`
         - `../CommitForm` -> keep as `../CommitForm` BUT WAIT -- CommitForm.test.tsx tests the ConventionalCommitForm-related behavior. Check what it actually tests. If it tests CommitForm (which stays in core), do NOT move it. If it tests ConventionalCommitForm (CC-only), move it.
         - READ `src/components/commit/__tests__/CommitForm.test.tsx` first to determine its imports and what it tests before deciding.

    6. Update `src/extensions/conventional-commits/index.ts`:
       - `../../blades/conventional-commit/ConventionalCommitBlade` -> `./blades/conventional-commit/ConventionalCommitBlade`
       - `../../blades/changelog/ChangelogBlade` -> `./blades/changelog/ChangelogBlade`
       - Keep `../../lib/bladeOpener` and `../../stores/domain/git-ops` as-is (correct depth)

    7. Update `src/components/commit/index.ts` barrel -- remove exports for moved files:
       - Remove: `ConventionalCommitForm`, `TypeSelector`, `ScopeAutocomplete`, `BreakingChangeSection`, `ValidationErrors`
       - If barrel becomes empty or only has shared items, keep what remains or remove if empty

    8. Check if any OTHER file imports from the OLD paths of moved files. Use grep for:
       - `from "../../components/commit/TypeSelector"` etc. -- should only be ConventionalCommitBlade which was already moved
       - `from "../../components/commit/ConventionalCommitForm"` -- check if anything besides CommitForm.tsx imports it
       If any external consumer imports a moved CC component, add a re-export shim in the old location OR update that consumer's import.

    9. Delete old directories/files after move:
       - Remove `src/blades/conventional-commit/` (should be empty)
       - Remove `src/blades/changelog/` (should be empty)
       - Remove moved files from `src/components/commit/` (TypeSelector, ScopeAutocomplete, etc.)
       - Do NOT remove `src/components/commit/` itself -- it still holds CommitForm, CommitHistory, CommitDetails, CommitSearch

    10. Run verification: `npx tsc --noEmit 2>&1 | grep -v "TS2440"` and `npx vitest run --reporter=verbose 2>&1 | tail -30`

    11. Commit: `refactor: move conventional-commits files into self-contained extension directory`
  </action>
  <verify>
    Run `npx tsc --noEmit 2>&1 | grep -v "TS2440"` -- should show no new errors.
    Run `npx vitest run` -- all tests pass.
    Verify old directories removed: `ls src/blades/conventional-commit/ src/blades/changelog/` should fail.
    Verify shared files remain: `ls src/components/commit/CommitForm.tsx src/components/commit/CommitHistory.tsx src/components/commit/CommitDetails.tsx src/components/commit/CommitSearch.tsx` should succeed.
    Verify new structure: `find src/extensions/conventional-commits -type f | sort` shows all expected files.
    Verify no dangling imports: `npx tsc --noEmit 2>&1 | grep "Cannot find module"` returns nothing.
  </verify>
  <done>
    Conventional-commits extension directory contains blades/ (conventional-commit/ + changelog/) and components/ subdirectories with all CC-specific files.
    Shared commit components (CommitForm, CommitHistory, CommitDetails, CommitSearch) remain in src/components/commit/ and core consumers are unaffected.
    src/blades/conventional-commit/ and src/blades/changelog/ are removed.
    CC-only component files removed from src/components/commit/.
    TypeScript compiles and all tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Final cleanup and verification</name>
  <files>
    src/components/commit/index.ts
  </files>
  <action>
    1. Run a comprehensive cross-check:
       - `npx tsc --noEmit 2>&1 | grep -v "TS2440"` -- zero errors
       - `npx vitest run` -- all tests pass
       - Verify ALL 4 extensions now follow the self-contained pattern:
         ```
         src/extensions/github/        -> blades/, components/, hooks/, types, store (already done)
         src/extensions/gitflow/       -> blades/, components/ (Task 1)
         src/extensions/content-viewers/ -> blades/ (Task 1)
         src/extensions/conventional-commits/ -> blades/, components/ (Task 2)
         ```

    2. Verify no orphan imports remain anywhere in the codebase pointing to old paths:
       - grep for `blades/gitflow-cheatsheet` -- should find 0 results
       - grep for `blades/viewer-markdown` -- should find 0 results
       - grep for `blades/viewer-code` -- should find 0 results
       - grep for `blades/viewer-3d` -- should find 0 results (except maybe registration in core if any)
       - grep for `blades/conventional-commit` -- should find 0 results
       - grep for `blades/changelog` -- should find 0 results
       - grep for `components/gitflow` -- should find 0 results
       - grep for `components/commit/TypeSelector` -- should find 0 results
       - grep for `components/commit/ScopeAutocomplete` -- should find 0 results
       - grep for `components/commit/ConventionalCommitForm` -- should find 0 results

    3. If `src/components/commit/index.ts` barrel is now empty or only re-exports shared items, clean it up:
       - If only CommitForm/CommitHistory/CommitDetails/CommitSearch remain and nothing imports from the barrel `components/commit` (vs direct file imports), remove the barrel entirely
       - If the barrel is still imported somewhere, keep it with only the remaining shared exports

    4. Commit: `refactor: final cleanup after extension file reorganization`
  </action>
  <verify>
    `npx tsc --noEmit 2>&1 | grep -v "TS2440"` returns no errors.
    `npx vitest run` all tests pass.
    `find src/extensions/gitflow -type f | wc -l` shows 12 files (index + 2 blade files + 9 component files).
    `find src/extensions/content-viewers -type f | wc -l` shows 7 files (index + 6 blade files).
    `find src/extensions/conventional-commits -type f | wc -l` shows 19+ files (index + blade tree + component tree).
    No orphan imports to old paths exist anywhere in the codebase.
  </verify>
  <done>
    All 4 extensions follow the self-contained directory pattern.
    No orphan imports remain.
    No empty old directories remain.
    TypeScript compiles cleanly and all tests pass.
    The codebase is cleaner with extension-specific code colocated within each extension.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit 2>&1 | grep -v "TS2440"` returns no errors after all tasks
- `npx vitest run` -- 207+ tests pass
- All 4 extensions are self-contained: `find src/extensions -mindepth 1 -maxdepth 1 -type d` shows github, gitflow, content-viewers, conventional-commits each with subdirectories
- No references to old paths: `grep -r "blades/gitflow-cheatsheet\|blades/viewer-markdown\|blades/viewer-code\|blades/viewer-3d\|blades/conventional-commit\|blades/changelog\|components/gitflow" src/ --include="*.ts" --include="*.tsx"` returns empty
- Core shared components unaffected: CommitForm, CommitHistory, CommitDetails still in src/components/commit/
</verification>

<success_criteria>
1. Each of the 4 extensions (github, gitflow, content-viewers, conventional-commits) is fully self-contained with its blades and components inside the extension directory
2. Shared components (CommitForm, CommitHistory, CommitDetails, CommitSearch, markdown components) remain in their core locations
3. Zero new TypeScript errors (ignoring pre-existing TS2440)
4. All existing tests pass from their new locations
5. No imports reference the old file paths
</success_criteria>

<output>
After completion, create `.planning/quick/34-move-files-related-to-extensions-closer-/34-SUMMARY.md`
</output>
