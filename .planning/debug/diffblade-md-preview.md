---
status: diagnosed
trigger: "DiffBlade markdown preview fails to load markdown content when toggling from Diff to Preview mode on .md files"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - File dispatch routing prevents .md files from reaching DiffBlade entirely
test: Traced all navigation paths for .md files through fileDispatch.ts and useBladeNavigation.ts
expecting: .md files routed to DiffBlade with diff data
next_action: Report root cause

## Symptoms

expected: When toggling from Diff to Preview on a .md file, the preview area should render the markdown content
actual: The preview area fills the correct width but markdown content fails to render
errors: No errors - .md files are silently routed to ViewerMarkdownBlade instead of DiffBlade
reproduction: Click any .md file in staging changes or commit details
started: Since commit 254d35c (feat(22-01): file dispatch registration) which maps .md -> viewer-markdown

## Eliminated

- hypothesis: rehype-sanitize strips markdown content
  evidence: Tested pipeline with realistic markdown - all 26 elements preserved correctly, text nodes intact
  timestamp: 2026-02-08T00:30:00Z

- hypothesis: MarkdownRenderer component has rendering bug
  evidence: ViewerMarkdownBlade uses same MarkdownRenderer successfully; react-markdown v10 pipeline produces correct hast tree
  timestamp: 2026-02-08T00:35:00Z

- hypothesis: CSS layout issue hides rendered content
  evidence: Container hierarchy (BladePanel -> DiffBlade -> preview div) uses correct flex/overflow patterns; commit f27a9fd already fixed width issue
  timestamp: 2026-02-08T00:40:00Z

- hypothesis: diff.newContent is empty or undefined
  evidence: Rust backend populates newContent for all non-binary scenarios (staged reads from index, unstaged reads from workdir, commit reads from commit tree); TypeScript bindings type correctly maps camelCase fields
  timestamp: 2026-02-08T00:45:00Z

- hypothesis: Lazy import of MarkdownRenderer fails
  evidence: File exists, lazy pattern is correct for named exports, Suspense boundary is in place, BladeErrorBoundary would catch thrown errors
  timestamp: 2026-02-08T00:50:00Z

## Evidence

- timestamp: 2026-02-08T00:20:00Z
  checked: src/lib/fileDispatch.ts lines 21-22
  found: FILE_DISPATCH_MAP maps "md" -> "viewer-markdown" and "mdx" -> "viewer-markdown"
  implication: bladeTypeForFile() returns "viewer-markdown" instead of "diff" for .md files

- timestamp: 2026-02-08T00:22:00Z
  checked: src/hooks/useBladeNavigation.ts openDiff() lines 38-49
  found: Only checks for type === "diff" and type === "viewer-image"; all other types fall through to generic pushBlade with only { filePath } -- loses commit oid
  implication: .md files in commit context go to ViewerMarkdownBlade showing HEAD content, not commit content

- timestamp: 2026-02-08T00:23:00Z
  checked: src/hooks/useBladeNavigation.ts openStagingDiff() lines 52-70
  found: Same pattern - only checks "diff" and "viewer-image"; other types get generic pushBlade with { filePath }
  implication: .md files in staging context go to ViewerMarkdownBlade showing HEAD content, not staged/unstaged changes

- timestamp: 2026-02-08T00:25:00Z
  checked: src/components/blades/ViewerMarkdownBlade.tsx
  found: Uses useRepoFile(filePath) which calls commands.readRepoFile() -- reads from HEAD only; has no diff capability, no Diff/Preview toggle
  implication: User sees stale HEAD content instead of their changes, no diff view available

- timestamp: 2026-02-08T00:28:00Z
  checked: src/components/blades/DiffBlade.tsx StagingDiffNavigation (lines 72-88)
  found: Uses store.replaceBlade with type: "diff" directly, bypassing bladeTypeForFile
  implication: This is the ONLY path where .md files reach DiffBlade (via prev/next file navigation arrows)

- timestamp: 2026-02-08T00:30:00Z
  checked: DiffBlade.tsx MarkdownRenderer integration (lines 263-273)
  found: Code is correct - passes diff.newContent to MarkdownRenderer with proper Suspense/lazy loading
  implication: The DiffBlade preview feature works when .md files actually reach it; the problem is they almost never do

- timestamp: 2026-02-08T00:32:00Z
  checked: Commit history for feature
  found: feat(22-07) at 8909e83 added markdown preview toggle; fix(22-12) at f27a9fd fixed width but not routing
  implication: The preview feature was built but file dispatch was never updated to route .md files to DiffBlade in diff contexts

## Resolution

root_cause: fileDispatch.ts unconditionally maps .md/.mdx files to "viewer-markdown" blade type, and useBladeNavigation.ts openDiff()/openStagingDiff() only handle "diff" and "viewer-image" explicitly. This causes .md files in staging/commit contexts to be routed to ViewerMarkdownBlade (read-only HEAD viewer) instead of DiffBlade (which has the diff editor + markdown preview toggle). The DiffBlade's markdown preview feature is effectively unreachable through normal navigation.
fix:
verification:
files_changed: []
