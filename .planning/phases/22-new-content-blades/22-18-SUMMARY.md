---
phase: 22-new-content-blades
plan: 18
subsystem: ui
tags: [diffblade, markdown, 3d-model, webgl, navigation, tauri]

requires:
  - phase: 22-new-content-blades
    provides: "DiffBlade with markdown preview toggle, Viewer3dBlade, useBladeNavigation"
provides:
  - "Correct routing of .md files to DiffBlade in diff/staging contexts"
  - "Working GLB model loading via atob in Tauri WKWebView"
  - "WebGL capability detection before 3D render attempt"
affects: [staging, commit-history, viewer-3d]

tech-stack:
  added: []
  patterns: ["atob/Uint8Array for binary base64 decode in Tauri (not fetch('data:...'))", "Context-aware file type routing in navigation hooks"]

key-files:
  created: []
  modified:
    - src/hooks/useBladeNavigation.ts
    - src/components/blades/Viewer3dBlade.tsx

key-decisions:
  - "Route viewer-markdown to DiffBlade in diff contexts (not fileDispatch) — preserves correct browse context behavior"
  - "Use atob/Uint8Array instead of fetch('data:...') for binary base64 decode — fetch fails in Tauri WKWebView custom protocol"

patterns-established:
  - "Navigation hooks override fileDispatch for context-specific routing (diff vs browse)"

duration: 3min
completed: 2026-02-08
---

# Phase 22 Plan 18: DiffBlade Markdown Routing + 3D Model Loading Summary

**Fixed .md diff routing to preserve DiffBlade preview toggle, reverted 3D model loading to atob/Uint8Array approach for Tauri WKWebView compatibility, added WebGL detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T23:28:00Z
- **Completed:** 2026-02-07T23:29:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- openDiff() and openStagingDiff() now route viewer-markdown to DiffBlade with correct source props
- 3D model binary loading uses atob + Uint8Array (avoids fetch('data:...') WKWebView restriction)
- WebGL capability detection prevents silent 3D render failures
- Diagnostic console.error logging added for both base64 decode and model load errors

## Task Commits

1. **Task 1: Route .md/.mdx to DiffBlade in diff contexts** - `6c00880` (fix)
2. **Task 2: Revert 3D model loading to atob with WebGL detection** - `6c00880` (fix, same commit)

## Files Created/Modified
- `src/hooks/useBladeNavigation.ts` - openDiff/openStagingDiff route viewer-markdown to diff blade
- `src/components/blades/Viewer3dBlade.tsx` - atob decode, WebGL check, diagnostic logging

## Decisions Made
- Fixed routing in navigation hooks rather than fileDispatch.ts — .md files should still open in viewer-markdown from repo browser, only diff/staging contexts override to DiffBlade

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Markdown files in staging/commit contexts now correctly open in DiffBlade with preview toggle. GLB models load via atob approach.

---
*Phase: 22-new-content-blades*
*Completed: 2026-02-08*
