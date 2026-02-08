---
status: diagnosed
trigger: "3D model viewer fails to load GLB files with 'Failed to load 3D model' error. Console shows an App component error."
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:00:00Z
---

## Current Focus

hypothesis: Multiple interacting issues cause model-viewer failure in Tauri WKWebView
test: Code analysis and trace of loading pipeline
expecting: Identify root causes that prevent GLB rendering
next_action: Report findings

## Symptoms

expected: GLB files opened from repo browser render in an interactive 3D viewer
actual: "Failed to load 3D model" error displayed; console shows App component error
errors: "Failed to load 3D model" (BladeContentError at Viewer3dBlade.tsx:219)
reproduction: Open a repository containing a .glb file, navigate to it in repo browser, click to open
started: Since viewer-3d blade was introduced; previous fix attempt (plan 22-18) reverted to atob decode

## Eliminated

- hypothesis: "CSP (Content-Security-Policy) blocks blob: URLs"
  evidence: tauri.conf.json line 26 sets "csp": null (disabled), no CSP restrictions
  timestamp: 2026-02-08

- hypothesis: "blob: URL is mangled by Three.js LoaderUtils.resolveURL"
  evidence: LoaderUtils.resolveURL (line 15714 in vite-optimized bundle) explicitly handles blob: URLs via `/^blob:.*$/i.test(url)` returning them unchanged
  timestamp: 2026-02-08

- hypothesis: "TypeScript type errors in model-viewer integration"
  evidence: `npx tsc --noEmit` produces no errors related to model-viewer or Viewer3dBlade
  timestamp: 2026-02-08

- hypothesis: "Blade registration is incorrect"
  evidence: registrations/viewer-3d.ts correctly lazy-imports and registers with type "viewer-3d", blade is in EXPECTED_TYPES list
  timestamp: 2026-02-08

- hypothesis: "Base64 decode is wrong"
  evidence: Rust backend (browse.rs:159-165) uses standard base64 encoding; JS side (lines 72-78) uses atob+Uint8Array which is correct for binary data. The decode itself should work.
  timestamp: 2026-02-08

## Evidence

- timestamp: 2026-02-08
  checked: Viewer3dBlade.tsx full source (355 lines)
  found: Component uses `import "@google/model-viewer"` as side-effect import at line 1; loads binary via `commands.readRepoFile()`, decodes base64 via atob, creates blob URL, passes to `<model-viewer src={blobUrl}>`
  implication: Side-effect import runs `customElements.define('model-viewer', ...)` which includes heavy Three.js initialization

- timestamp: 2026-02-08
  checked: model-viewer loading pipeline (vite-optimized bundle analysis)
  found: Loading chain: `<model-viewer src>` -> Lit property change -> `$updateSource()` -> `scene.setSource(url)` -> `CachingGLTFLoader.load(url)` -> `GLTFLoader.load(url)` -> `FileLoader.load(url)` -> `fetch(new Request(url))`. The fetch of blob: URLs should work in principle.
  implication: The error likely occurs either (A) during the import/module-evaluation side effects, or (B) during the model-viewer element construction/rendering

- timestamp: 2026-02-08
  checked: model-viewer WKWebView detection
  found: Line 28495 of vite bundle: `var IS_WKWEBVIEW = Boolean(window.webkit && window.webkit.messageHandlers)`. Tauri v2 on macOS uses WKWebView and DOES inject `window.webkit.messageHandlers`, so model-viewer detects this as WKWebView. Line 28489: `var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !self.MSStream || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1`. On macOS desktops, `maxTouchPoints` may be > 1 if trackpad is present, potentially causing IS_IOS=true.
  implication: Model-viewer's behavior branches may incorrectly treat Tauri desktop as iOS WKWebView, affecting AR/loading logic

- timestamp: 2026-02-08
  checked: Renderer singleton initialization (lines 40576-40660)
  found: Renderer creates WebGLRenderer in a try/catch. If WebGL init fails, `this.threeRenderer` is null and `canRender` returns false. The renderer also creates MeshoptDecoder (WASM - line 29119-29127) during module evaluation, which requires WebAssembly support.
  implication: If WebGL renderer creation fails silently (caught at line 40658-40660), model loading will fail downstream

- timestamp: 2026-02-08
  checked: Error handling in `$updateSource` (lines 44553-44587)
  found: If `scene.setSource()` throws, the catch block dispatches a CustomEvent("error") with `{ type: "loadfailure", sourceError: error }`. This is caught by the Viewer3dBlade error listener at line 130-135 which extracts the message and calls `setFetchError(msg)`.
  implication: The "Failed to load 3D model" error is the correct error path - model-viewer's internal loading is failing

- timestamp: 2026-02-08
  checked: `$shouldAttemptPreload` in LoadingMixin (line 47829-47830)
  found: Preload requires `!!this.src && (this[$shouldDismissPoster] || this.loading === LoadingStrategy.EAGER || this.reveal === RevealStrategy.AUTO && this[$isElementInViewport])`. The default `reveal` is "auto" and default `loading` is "auto" (lazy). With IntersectionObserver, element must be in viewport.
  implication: If the model-viewer element has zero dimensions when created (before layout), IntersectionObserver may never report it as visible, and loading never starts. However, the component does set `width: "100%", height: "100%"` in style.

- timestamp: 2026-02-08
  checked: Vite build target
  found: vite.config.ts line 18: `target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13"`. On macOS, code is transpiled to safari13 compatibility level.
  implication: Safari 13 is quite old (2019). While @google/model-viewer v4 generally supports Safari, some features or Lit Element patterns may have edge-case issues with safari13 target transpilation. The Lit reactive element uses features like `adoptedStyleSheets` (line 6: `supportsAdoptingStyleSheets`) with fallback, so this should be handled.

- timestamp: 2026-02-08
  checked: model-viewer error event naming
  found: At line 44583, the error dispatches type "loadfailure". At line 44295, context lost dispatches type "webglcontextlost". The Viewer3dBlade error handler (line 130-135) listens for the "error" CustomEvent (not "loadfailure") and extracts `detail.sourceError?.message || detail?.type`. So it correctly receives "loadfailure" as the type string when loading fails.
  implication: If the actual error has no sourceError.message, the displayed detail will just be "loadfailure" which is unhelpful for debugging

- timestamp: 2026-02-08
  checked: BladeErrorBoundary wrapping
  found: BladeRenderer.tsx wraps every blade content in BladeErrorBoundary (lines 34-38). If the side-effect `import "@google/model-viewer"` throws during the lazy chunk evaluation (before component renders), React's Suspense boundary would catch it. If the component throws during render, BladeErrorBoundary catches it.
  implication: "App component error" in console likely comes from BladeErrorBoundary.componentDidCatch (line 29-31) logging `[BladeError] {title}: {error}`, or from an uncaught error during the lazy import itself

## Resolution

root_cause: |
  **PRIMARY: model-viewer web component internal failure in Tauri WKWebView environment**

  The root cause is a combination of environmental factors that cause @google/model-viewer v4.1.0 to fail in Tauri's WKWebView on macOS:

  1. **WKWebView misdetection (HIGH CONFIDENCE)**
     File: `node_modules/.vite/deps/@google_model-viewer.js` lines 28489-28495
     - `IS_WKWEBVIEW = Boolean(window.webkit && window.webkit.messageHandlers)` returns TRUE in Tauri (Tauri uses WKWebView and injects these handlers)
     - `IS_IOS` may also return TRUE on MacBooks with trackpads (`navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1`)
     - model-viewer's code paths for WKWebView/iOS differ from desktop behavior
     - Google model-viewer team explicitly states they do NOT support webviews (GitHub Discussion #2193, Issue #1090)

  2. **Three.js WebGL initialization may fail silently (MEDIUM CONFIDENCE)**
     File: `node_modules/.vite/deps/@google_model-viewer.js` lines 40643-40660
     - The WebGLRenderer constructor is wrapped in try/catch with only `console.warn(error)`
     - If WebGL context creation fails or is limited in the WKWebView, the renderer silently becomes null
     - `canRender` returns false, but model loading still attempts to proceed, leading to errors downstream

  3. **Lazy import side-effect crash potential (MEDIUM CONFIDENCE)**
     File: `src/components/blades/Viewer3dBlade.tsx` line 1
     - `import "@google/model-viewer"` is a side-effect-only import that immediately:
       (a) Instantiates WASM decoders (MeshoptDecoder) at module evaluation time
       (b) Calls `customElements.define('model-viewer', ModelViewerElement)` which sets up the entire Three.js rendering pipeline
     - If any of these fail during the lazy chunk load, the entire chunk evaluation fails, which React's Suspense/ErrorBoundary catches as an "App component error"

  4. **Error message opacity (CONTRIBUTING)**
     File: `src/components/blades/Viewer3dBlade.tsx` lines 130-135
     - The error handler extracts `sourceError?.message || detail?.type || "Failed to render 3D model"` but many model-viewer internal errors don't populate `sourceError.message`, so the user sees a generic message with no actionable detail

fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []

## Fix Recommendations

### Option A: Wrap model-viewer import with error resilience (MINIMAL FIX)

In `Viewer3dBlade.tsx`, catch import failures gracefully and show a meaningful error:

```tsx
// Instead of: import "@google/model-viewer";
// Use dynamic import with error handling in the component:

const [viewerReady, setViewerReady] = useState(false);
const [importError, setImportError] = useState<string | null>(null);

useEffect(() => {
  import("@google/model-viewer")
    .then(() => setViewerReady(true))
    .catch((err) => {
      console.error("[Viewer3dBlade] model-viewer import failed:", err);
      setImportError(err instanceof Error ? err.message : "Failed to initialize 3D viewer");
    });
}, []);
```

### Option B: Add comprehensive error logging to diagnose the EXACT failure

Before fixing, add telemetry to the error handler to capture the actual error:

```tsx
const onError = (e: Event) => {
  const detail = (e as CustomEvent).detail;
  console.error("[Viewer3dBlade] model-viewer error event:", JSON.stringify({
    type: detail?.type,
    sourceError: detail?.sourceError?.message,
    sourceErrorStack: detail?.sourceError?.stack,
    blobUrl: blobUrl?.substring(0, 50),
  }));
  // ... existing error handling
};
```

### Option C: Replace model-viewer with direct Three.js GLTFLoader (DEFINITIVE FIX)

Since model-viewer is not officially supported in webviews, and the WKWebView misdetection causes behavioral issues, replace the `<model-viewer>` web component with a direct Three.js implementation:

```tsx
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, DirectionalLight } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
```

This eliminates:
- The web component registration overhead
- Lit Element shadow DOM compatibility issues
- WKWebView misdetection
- The 48,000-line model-viewer bundle overhead

### Option D: Add `loading="eager"` and explicit dimensions (QUICK TRY)

The IntersectionObserver-based lazy loading in model-viewer may not fire correctly in the blade panel layout. Force eager loading:

```tsx
<model-viewer
  ref={viewerRef as React.Ref<never>}
  src={blobUrl}
  loading="eager"
  reveal="auto"
  style={{ width: "100%", height: "100%", minHeight: "300px", ... }}
/>
```

### Recommended approach

Start with **Option A** (graceful import) + **Option B** (error logging) to confirm the exact failure point. If the error is in the import itself (module evaluation), Option C (direct Three.js) is the correct long-term fix. If the error is only in model rendering, Option D may suffice.
