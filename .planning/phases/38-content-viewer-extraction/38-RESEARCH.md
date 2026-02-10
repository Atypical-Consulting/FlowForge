# Phase 38: Content Viewer Extraction — Synthesized Research

**Researched:** 2026-02-10
**Sources:** 3 parallel researchers (UX, Architecture, Implementation)
**Confidence:** HIGH across all domains

## Summary

Phase 38 extracts Markdown, Code (Monaco), and 3D (Three.js) viewers from core blade registrations into a single built-in `content-viewers` extension. The codebase is well-structured for extraction — viewer blades are isolated in `src/blades/viewer-{type}/` with clean `{ filePath: string }` interfaces, and the extension system (Phase 37) provides robust `registerBuiltIn()` + `ExtensionAPI` foundation.

**Three researchers converge on the same core strategy:**

1. Add a `coreOverride?: boolean` flag to `ExtensionBladeConfig` so the content-viewers extension registers blades under their ORIGINAL core type names (`viewer-markdown`, `viewer-code`, `viewer-3d`) — avoiding cascading namespace changes
2. Create a minimal `viewer-plaintext` core blade as always-available fallback
3. Change `fileDispatch.ts` browse fallback from `"viewer-code"` to `"viewer-plaintext"`
4. Keep blade component files in their current locations, dynamically import from the extension
5. Keep `MarkdownRenderer`, Monaco config, and `monacoTheme` in core (shared with DiffBlade + GitHub ext)

## Key Architectural Decisions (Consensus)

### 1. coreOverride Registration (All 3 agree)

The content-viewers extension uses `coreOverride: true` so blade types remain `viewer-markdown`, `viewer-code`, `viewer-3d` (not namespaced). This means:
- **No changes** to `useBladeNavigation.ts` hardcoded type checks
- **No changes** to `BladePropsMap` in `bladeTypes.ts`
- **No changes** to `RepoBrowserBlade.tsx` blade type references
- **Minimal fileDispatch.ts changes** (only browse fallback)
- Extension cleanup still works via `source` tracking

### 2. Shared Dependencies Stay in Core (All 3 agree)

| Component | Location | Shared With |
|-----------|----------|-------------|
| `MarkdownRenderer` + sub-components | `src/components/markdown/` | DiffBlade, GitHub extension |
| `monacoConfig.ts`, `monacoTheme.ts`, `monacoWorkers.ts` | `src/lib/` | DiffBlade, InlineDiffViewer |
| `useRepoFile` hook | `src/hooks/` | All blades |
| `BladeContent*` components | `src/blades/_shared/` | All blades |

Only Three.js is exclusively used by Viewer3dBlade and can be truly isolated.

### 3. viewer-plaintext Core Fallback (All 3 agree)

A minimal `<pre>` + `useRepoFile` blade (~40 lines) that:
- Has NO heavy dependencies (no Monaco, no react-markdown, no Three.js)
- Is always registered as a core blade
- Serves as browse-context fallback when content-viewers is disabled
- Shows binary file placeholder for non-text files

### 4. Blade File Location (2 of 3 agree: keep in place)

Architecture and UX researchers recommend keeping blade component files in `src/blades/viewer-{type}/` and dynamically importing from the extension. Implementation researcher suggests moving to `src/extensions/content-viewers/blades/`.

**Recommendation: Keep in place.** This minimizes diff, avoids import path updates in test files, and follows the principle of least change. Only `registration.ts` files are deleted.

### 5. Scope: Only 3 Viewers (All 3 agree)

Extract: `viewer-markdown`, `viewer-code`, `viewer-3d`
Keep in core: `viewer-image` (no heavy deps, used by `useBladeNavigation` directly), `viewer-nupkg` (niche)

### 6. Lazy Loading Strategy (All 3 agree)

Use `React.lazy()` in the extension (NOT `ensureComponents()` like GitHub extension) to preserve on-demand loading of Monaco (~3MB) and Three.js (~600KB):

```typescript
const ViewerCodeBlade = lazy(() =>
  import("../../blades/viewer-code/ViewerCodeBlade").then(m => ({ default: m.ViewerCodeBlade }))
);
api.registerBlade({ type: "viewer-code", component: ViewerCodeBlade, lazy: true, coreOverride: true });
```

## Files Changed Summary

### Created
| File | Purpose |
|------|---------|
| `src/extensions/content-viewers/index.ts` | Extension entry point (onActivate/onDeactivate) |
| `src/blades/viewer-plaintext/ViewerPlaintextBlade.tsx` | Core fallback viewer |
| `src/blades/viewer-plaintext/registration.ts` | Core registration |

### Deleted
| File | Why |
|------|-----|
| `src/blades/viewer-markdown/registration.ts` | Registration moves to extension |
| `src/blades/viewer-code/registration.ts` | Registration moves to extension |
| `src/blades/viewer-3d/registration.ts` | Registration moves to extension |

### Modified
| File | Change |
|------|--------|
| `src/extensions/ExtensionAPI.ts` | Add `coreOverride?: boolean` to `ExtensionBladeConfig` |
| `src/blades/_discovery.ts` | Remove viewer-markdown, viewer-code, viewer-3d from EXPECTED_TYPES |
| `src/stores/bladeTypes.ts` | Add viewer-plaintext to BladePropsMap |
| `src/lib/fileDispatch.ts` | Change browse fallback from "viewer-code" to "viewer-plaintext" |
| `src/App.tsx` | Add registerBuiltIn() for content-viewers |
| `src/blades/_shared/BladeRenderer.tsx` | Improve "Unknown blade" fallback for disabled extensions |

### Unchanged (explicitly confirmed)
- `src/hooks/useBladeNavigation.ts` — blade type names unchanged (coreOverride)
- `src/blades/repo-browser/RepoBrowserBlade.tsx` — blade type names unchanged
- `src/components/markdown/*` — stays in core
- `src/lib/monacoConfig.ts`, `monacoTheme.ts` — stays in core
- `src/blades/viewer-image/*` — stays in core
- `src/blades/viewer-nupkg/*` — stays in core

## Critical Pitfalls

1. **MarkdownRenderer stays in core** — shared with DiffBlade + GitHub ext. Moving it breaks both.
2. **Monaco theme side-effect import** — ViewerCodeBlade must preserve `import "../../lib/monacoTheme"` (path-sensitive)
3. **Three.js must stay lazy** — Use `React.lazy()`, NOT `ensureComponents()` to avoid 600KB eager load
4. **_discovery.ts EXPECTED_TYPES** — Remove extracted blade types to avoid console warnings
5. **Browse fallback** — Must be `viewer-plaintext` (core), not `viewer-code` (extension) when extension disabled
6. **Extension activation timing** — Register content-viewers BEFORE GitHub extension in App.tsx

## Recommended Plan Structure

```
Plan 38-01: ExtensionAPI coreOverride + viewer-plaintext fallback
  - Add coreOverride to ExtensionBladeConfig
  - Create viewer-plaintext core blade
  - Change fileDispatch browse fallback
  - Tests

Plan 38-02: Content-viewers extension + graceful degradation
  - Create extension entry point
  - Register in App.tsx
  - Delete old registration.ts files
  - Update _discovery.ts
  - Improve BladeRenderer fallback
  - Extension lifecycle tests
  - Graceful degradation verification
```

## Open Questions (Resolved)

| Question | Answer | Source |
|----------|--------|--------|
| Namespaced vs core blade types? | Core types via `coreOverride` | All 3 researchers |
| Move component files? | Keep in place, dynamic import | Architecture + UX |
| Zustand for fileDispatch? | No, simple Map sufficient | All 3 researchers |
| Extract viewer-image? | No, stays in core | All 3 researchers |
| How to lazy-load? | React.lazy(), NOT ensureComponents() | Implementation researcher |

---
*Research synthesized: 2026-02-10*
*3 researchers, HIGH confidence across all domains*
