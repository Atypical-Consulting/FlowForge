---
phase: 22-new-content-blades
plan: 16
status: complete
gap_closure: true
---

# Plan 22-16: Unified Breadcrumb UX Across All Blades

## What Was Built
Created a shared BladeBreadcrumb component and unified all file-path blade headers to use interactive, clickable breadcrumbs instead of static path display.

## Changes
- Created `BladeBreadcrumb.tsx` with Home icon, clickable parent segments, and static current segment
- Added `renderPathBreadcrumb` helper to `bladeUtils.tsx` (parallel to existing `renderPathTitle`)
- Updated 7 blade registrations to use `renderPathBreadcrumb`: viewer-code, viewer-markdown, viewer-3d, viewer-image, viewer-nupkg, diff, repo-browser
- Removed inline `Breadcrumbs` component and `BladeToolbar` wrapper from RepoBrowserBlade
- Repo browser header now shows breadcrumb in same row as back button (single-row layout)

## Key Files
- `src/components/blades/BladeBreadcrumb.tsx` (created)
- `src/lib/bladeUtils.tsx` (modified)
- `src/components/blades/registrations/viewer-code.ts` (modified)
- `src/components/blades/registrations/viewer-markdown.ts` (modified)
- `src/components/blades/registrations/viewer-3d.ts` (modified)
- `src/components/blades/registrations/viewer-image.ts` (modified)
- `src/components/blades/registrations/viewer-nupkg.ts` (modified)
- `src/components/blades/registrations/diff.tsx` (modified)
- `src/components/blades/registrations/repo-browser.tsx` (modified)
- `src/components/blades/RepoBrowserBlade.tsx` (modified)

## Commit
- `d72f0a6 feat(22-16): unified breadcrumb UX across all blades`

## Extensibility Impact
Adding breadcrumbs to a new file-based blade now requires only: `renderTitleContent: (props) => renderPathBreadcrumb(props.filePath)` in the registration file. No changes to BladeBreadcrumb, BladePanel, or any other shared component.

## Self-Check: PASSED
- Shared BladeBreadcrumb renders clickable path segments with Home icon
- All 7 file-path blade registrations use renderPathBreadcrumb
- RepoBrowserBlade header is single row (no separate BladeToolbar)
- TypeScript compiles clean
