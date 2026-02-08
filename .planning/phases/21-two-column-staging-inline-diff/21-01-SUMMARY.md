# Plan 21-01 Summary: Foundation

**Status:** Complete
**Commits:** d3af08a, ac1ce25

## What was built

1. **SplitPaneLayout** (`src/components/layout/SplitPaneLayout.tsx`) — Generic reusable two-column list+detail layout wrapping the existing `ResizablePanelLayout`, `ResizablePanel`, and `ResizeHandle`. Configurable split ratio, min/max sizes, persistent via `autoSaveId`.

2. **Staging store extensions** (`src/stores/staging.ts`) — Added `scrollPositions`, `fileListScrollTop`, `saveScrollPosition`, `setFileListScrollTop`, `clearScrollPositions` for state preservation across blade push/pop.

3. **Preview registry** (`src/lib/previewRegistry.ts`) — Registry pattern for mapping file types to preview modes (inline-diff, placeholder, custom). `registerPreview()` / `getPreviewForFile()` API.

4. **Default preview registrations** (`src/components/staging/previewRegistrations.ts`) — Registered binary, image, archive, 3D model (placeholders) and text-diff (catch-all) preview types.

5. **File type utilities** (`src/lib/fileTypeUtils.ts`) — Extracted `bladeTypeForFile()` from `useBladeNavigation.ts` into shared utility. Added `isTextDiffable()` and `isBinaryFile()`.

6. **Updated barrel export** (`src/components/layout/index.ts`) — Added `SplitPaneLayout` to layout exports.

7. **Updated useBladeNavigation** — Now imports `bladeTypeForFile` from shared utility instead of defining inline.

## Deviations

None.

## Verification

- `npx tsc --noEmit` passes with no new errors (pre-existing bindings.ts error excluded)
- All exports verified importable
- Existing staging behavior unchanged
