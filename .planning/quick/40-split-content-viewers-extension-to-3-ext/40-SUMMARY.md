# Quick Task 40: Split content viewers extension to 3 extensions

## What Changed

Split the monolithic `content-viewers` extension into 3 independent extensions:

| Extension | Blade Type | Viewer |
|-----------|-----------|--------|
| `viewer-code` | `viewer-code` | Monaco Editor for code files |
| `viewer-markdown` | `viewer-markdown` | react-markdown for .md files |
| `viewer-3d` | `viewer-3d` | Three.js for GLTF/GLB models |

## Files Changed

### Created (9 new files)
- `src/extensions/viewer-code/index.ts` - Code viewer extension entry
- `src/extensions/viewer-code/blades/ViewerCodeBlade.tsx` - (moved)
- `src/extensions/viewer-code/blades/ViewerCodeBlade.test.tsx` - (moved)
- `src/extensions/viewer-markdown/index.ts` - Markdown viewer extension entry
- `src/extensions/viewer-markdown/blades/ViewerMarkdownBlade.tsx` - (moved)
- `src/extensions/viewer-markdown/blades/ViewerMarkdownBlade.test.tsx` - (moved)
- `src/extensions/viewer-3d/index.ts` - 3D viewer extension entry
- `src/extensions/viewer-3d/blades/Viewer3dBlade.tsx` - (moved)
- `src/extensions/viewer-3d/blades/Viewer3dBlade.test.tsx` - (moved)
- `src/extensions/__tests__/viewer-code.test.ts` - Integration test
- `src/extensions/__tests__/viewer-markdown.test.ts` - Integration test
- `src/extensions/__tests__/viewer-3d.test.ts` - Integration test

### Modified
- `src/App.tsx` - Registers 3 separate extensions instead of 1

### Deleted
- `src/extensions/content-viewers/` - Entire old directory
- `src/extensions/__tests__/content-viewers.test.ts` - Old integration test

## Verification

- TypeScript: Clean (0 errors)
- Tests: 18/18 passing (6 per extension)
- No broken imports or stale references
