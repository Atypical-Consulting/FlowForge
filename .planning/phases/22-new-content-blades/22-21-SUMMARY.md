---
phase: 22-new-content-blades
plan: 21
subsystem: ui
tags: [three.js, gltf, glb, webgl, 3d, tauri, wkwebview]

requires:
  - phase: 22 (plans 01-19)
    provides: Viewer3dBlade component with model-viewer, blade registration
provides:
  - Three.js-based 3D model viewer replacing @google/model-viewer
  - WebGL context loss detection without Shadow DOM
  - Proper Three.js scene cleanup (geometries, materials, textures)
affects: [viewer-3d, package.json]

tech-stack:
  added: [three.js r182, @types/three]
  removed: [@google/model-viewer]
  patterns: [GLTFLoader.parse for in-memory ArrayBuffer, OrbitControls with damping]

key-files:
  created: []
  modified:
    - src/components/blades/Viewer3dBlade.tsx
    - package.json
  deleted:
    - src/types/model-viewer.d.ts

key-decisions:
  - "Used three/examples/jsm/ import path for GLTFLoader and OrbitControls (r182 convention)"
  - "Indeterminate loading (animate-pulse) instead of progress bar since GLTFLoader.parse doesn't report progress for in-memory data"
  - "bufferRef pattern to pass ArrayBuffer from loadModel callback to Three.js setup effect"

patterns-established:
  - "Three.js scene cleanup: traverse all meshes, dispose geometries/materials/textures, then dispose renderer"

duration: 5min
completed: 2026-02-08
---

# Plan 22-21: Replace model-viewer with Three.js Summary

**Three.js + GLTFLoader replaces @google/model-viewer, eliminating WKWebView misdetection crash in Tauri**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08
- **Completed:** 2026-02-08
- **Tasks:** 2
- **Files modified:** 3 (1 rewritten, 1 deleted, 1 dependency update)

## Accomplishments
- Complete rewrite of Viewer3dBlade from web component to direct Three.js rendering
- Eliminated WKWebView misdetection that caused model-viewer to crash in Tauri
- Native canvas WebGL context loss detection (no Shadow DOM polling needed)
- Proper Three.js cleanup on unmount prevents memory leaks
- Lazy-loaded chunk: 612KB (vs model-viewer's 48K-line bundle)

## Task Commits

1. **Task 1: Install three.js, remove model-viewer** - `b82c40c` (feat)
2. **Task 2: Rewrite Viewer3dBlade with Three.js** - `b82c40c` (feat)

## Files Created/Modified
- `src/components/blades/Viewer3dBlade.tsx` - Complete rewrite with Three.js + GLTFLoader + OrbitControls
- `src/types/model-viewer.d.ts` - Deleted (JSX type declarations no longer needed)
- `package.json` - Added three, @types/three; removed @google/model-viewer

## Decisions Made
- Used bufferRef to bridge async loadModel and Three.js setup effect
- Catppuccin base color (0x1e1e2e) as scene background

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- 3D viewer ready for verification with actual .glb/.gltf files

---
*Phase: 22-new-content-blades*
*Completed: 2026-02-08*
