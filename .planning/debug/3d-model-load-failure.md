---
status: investigating
trigger: "Investigate why opening a .glb file from the repo browser shows 'Failed to load 3D model' — post fix 22-13"
created: 2026-02-07T00:00:00Z
updated: 2026-02-08T12:00:00Z
---

## Current Focus

hypothesis: Multiple remaining failure paths exist after 22-13 fix, requiring deeper investigation
test: Full code trace through all three layers (data pipeline, model-viewer internals, environment)
expecting: Identify which specific layer fails and under what conditions
next_action: Return comprehensive diagnosis with all remaining issues

## Symptoms

expected: Opening a .glb file from repo browser should display a 3D model
actual: Shows "Failed to load 3D model"
errors: "Failed to load 3D model"
reproduction: Open any .glb file from the repo browser
started: Unknown — may have never worked

## Eliminated

- hypothesis: Backend returns wrong data format
  evidence: Rust read_repo_file correctly detects binary via null byte check, correctly base64-encodes with STANDARD engine
  timestamp: 2026-02-07T00:01:00Z

- hypothesis: MIME type is wrong for GLB
  evidence: model/gltf-binary is the correct IANA-registered MIME type per Khronos glTF 2.0 spec
  timestamp: 2026-02-07T00:02:00Z

- hypothesis: CSP blocks blob URLs
  evidence: tauri.conf.json has "csp": null (no CSP restrictions)
  timestamp: 2026-02-07T00:02:30Z

- hypothesis: model-viewer doesn't support blob URLs
  evidence: model-viewer documentation confirms blob URLs work via URL.createObjectURL()
  timestamp: 2026-02-07T00:03:00Z

- hypothesis: React 19 breaks model-viewer custom element
  evidence: React 19 correctly sets src as Lit property; model-viewer uses @property decorator for src
  timestamp: 2026-02-07T00:03:30Z

- hypothesis: Tauri IPC truncates large payloads
  evidence: No hard size limit; slow but delivers intact data
  timestamp: 2026-02-07T00:04:00Z

- hypothesis: atob()+charCodeAt() pattern is broken
  evidence: Standard widely-used pattern — but now replaced by fetch-based approach in 22-13
  timestamp: 2026-02-07T00:04:30Z

- hypothesis: Error handler swallows diagnostic info
  evidence: Fixed in 22-13 — handler now captures detail.sourceError.message
  timestamp: 2026-02-08T12:00:00Z

- hypothesis: environment-image="neutral" causes failure
  evidence: Attribute removed in 22-13 — but environment generation STILL runs (see evidence below)
  timestamp: 2026-02-08T12:01:00Z

- hypothesis: Duplicate blade registration causes 3D viewer malfunction
  evidence: HMR re-executes registration modules causing warnings, but registry.set() overwrites correctly. Functionally harmless — cosmetic DEV warning only.
  timestamp: 2026-02-08T12:02:00Z

## Evidence

- timestamp: 2026-02-07T00:00:30Z
  checked: Rust backend read_repo_file (src-tauri/src/git/browse.rs lines 118-178)
  found: Binary files correctly detected and base64-encoded using STANDARD engine (no line breaks). Same encoding used by working get_file_base64.
  implication: Backend data pipeline is correct

- timestamp: 2026-02-07T00:01:00Z
  checked: Viewer3dBlade.tsx error event handler (lines 105-110)
  found: Post-fix handler now captures detail.sourceError.message and detail.type. Correct implementation.
  implication: Error diagnostics are now available in the detail text

- timestamp: 2026-02-07T00:02:00Z
  checked: model-viewer-base.js updateSource method (lines 464-506)
  found: updateSource runs Promise.all([srcUpdated, envUpdated]) at line 484. BOTH must succeed. catch block (line 500-502) dispatches error event with type='loadfailure' and sourceError containing the actual Error object.
  implication: Either src loading or environment generation failure triggers same error event

- timestamp: 2026-02-08T12:00:00Z
  checked: environment.js $updateEnvironment (lines 87-124) and TextureUtils.js (lines 120-151)
  found: Even with environment-image attribute REMOVED, $updateEnvironment STILL runs during $updateSource (line 483). It falls through to loadGeneratedEnvironmentMapAlt() (line 200-204) which generates a procedural "neutral" environment map using WebGL cube rendering (GenerateEnvironmentMap at line 162-183). If this returns null, line 148 throws "Failed to load environment map."
  implication: Removing the attribute did NOT eliminate the environment failure path — it just changed which code path generates the map

- timestamp: 2026-02-08T12:01:00Z
  checked: Renderer.js constructor (lines 114-137)
  found: textureUtils is set to null when canRender is false (line 136-137). canRender checks this.threeRenderer != null. If WebGL context creation fails (try/catch at line 114-134), threeRenderer stays null, canRender is false, textureUtils is null.
  implication: If WebGL context fails to create, textureUtils is null, and $updateEnvironment returns early (line 94-96) — environment generation is skipped entirely. This is actually a safe path.

- timestamp: 2026-02-08T12:02:00Z
  checked: Three.js FileLoader.js (used by GLTFLoader for model loading)
  found: FileLoader.load() uses the fetch() API (line 88) to load the source URL. When model-viewer receives a blob URL, Three.js fetches it. fetch() with blob: URLs should work from any origin (same-origin policy applies to blob URLs).
  implication: The blob URL fetch itself should work, but any failure would surface as an error in the setSource promise

- timestamp: 2026-02-08T12:03:00Z
  checked: fetch('data:...') compatibility in Tauri v2 WKWebView on macOS
  found: Tauri v2 on macOS serves the frontend via a custom protocol scheme. WKWebView is known to restrict fetch() from pages served via custom schemes. While data: and blob: URIs are generally same-origin exempt, there are edge cases. In DEV mode (devUrl: "http://localhost:1420"), fetch('data:...') should work since the page is served over HTTP. In PRODUCTION mode (custom tauri:// protocol), fetch('data:...') might fail.
  implication: The data URI fetch approach may fail in production Tauri builds but work in development

- timestamp: 2026-02-08T12:04:00Z
  checked: Event listener timing in Viewer3dBlade.tsx
  found: useEffect at line 84 registers error/load/progress listeners AFTER React renders the model-viewer with the new src. React renders synchronously, then useEffect runs. model-viewer's Lit updated() fires during render and calls $updateSource(). However, $updateSource is async (awaits Promise.all), so the error event fires after the useEffect has registered listeners. TIMING IS SAFE.
  implication: Event listener race condition is NOT the issue

- timestamp: 2026-02-08T12:05:00Z
  checked: IntersectionObserver initialization in model-viewer-base.js
  found: $isElementInViewport starts as false (line 144). IntersectionObserver is set up in connectedCallback() and fires asynchronously. $shouldAttemptPreload() returns false until IO callback fires. When IO reports isIntersecting=true, $updateSource() is called (line 229). Loading is deferred but works correctly.
  implication: Model loading waits for visibility — this is by design and works correctly

- timestamp: 2026-02-08T12:06:00Z
  checked: Duplicate blade registration warnings
  found: bladeRegistry.ts line 22-24 warns in DEV when registry.has(config.type) is true. This fires during HMR when Vite re-executes registration modules. The registry Map is module-level (persists across HMR), but registry.set() at line 25 simply overwrites. registrations/index.ts uses import.meta.glob with eager: true — all registration files execute on import.
  implication: Duplicate registration is cosmetic HMR noise, not a functional issue. Does NOT affect 3D viewer loading.

## Resolution

root_cause: |
  THREE REMAINING ISSUES after the 22-13 fix:

  ISSUE 1 - ENVIRONMENT GENERATION STILL RUNS (HIGH):
  Removing environment-image="neutral" from the HTML attribute did NOT eliminate the
  environment generation code path. In model-viewer-base.js line 483, $updateEnvironment()
  is ALWAYS called as part of $updateSource(), regardless of attributes. The environment.js
  $updateEnvironment method (line 87) reads the environmentImage property. When null/undefined,
  TextureUtils.generateEnvironmentMapAndSkybox() at line 120 falls through to
  loadGeneratedEnvironmentMapAlt() (line 200-204), which procedurally generates a "neutral"
  environment map using WebGL cube rendering (GenerateEnvironmentMap, line 162-183).

  This means: if WebGL cube rendering fails or the environment map generation returns null,
  line 148 throws "Failed to load environment map." and the error propagates to the error
  event. The Promise.all at line 484 means this kills the ENTIRE load — even if the model
  data itself was perfectly valid.

  ISSUE 2 - fetch('data:...') RELIABILITY IN TAURI (MEDIUM):
  The 22-13 fix replaced atob()/charCodeAt() with fetch(dataUri). While this handles large
  files better, fetch() with data: URIs may not work reliably in Tauri v2's production build
  on macOS, where the frontend is served via a custom protocol scheme (tauri://localhost).
  WKWebView applies restrictions to fetch() from custom protocol origins.

  In development mode (http://localhost:1420), this works fine. In production, the data URI
  fetch may silently fail or throw a network error, which would be caught at line 65-66 and
  show as "Failed to load model" in the catch block.

  ISSUE 3 - TWO ERROR PATHS, CONFUSING UX (LOW):
  There are two independent paths that set fetchError:
    a) Line 66: catch in loadModel() — catches data pipeline failures
    b) Line 109: model-viewer error event — catches model-viewer internal failures
  Both show the same BladeContentError with message="Failed to load 3D model".
  Path (a) fires immediately during data load.
  Path (b) fires later when model-viewer tries to render.
  If path (a) succeeds but path (b) fails, the component briefly shows the model-viewer
  (with opacity:0 and loading overlay), THEN switches to the error state. The fetchError
  from path (a) is cleared by loadModel() line 30, so only path (b)'s error shows.

fix: |
  FIX 1 (Critical - eliminate environment failure path):
  model-viewer's $updateEnvironment always generates an environment map even without the
  attribute. To truly prevent environment-related failures from killing model loading,
  the component needs either:
    a) A workaround: Use loading="eager" to bypass IntersectionObserver timing
    b) Handle model-viewer errors with retry logic that catches environment failures
    c) Pre-check WebGL capability before attempting to render

  However, the real question is: does WebGL work at all in the user's environment?
  If WebGL context creation fails, model-viewer cannot render anything — no fix in the
  React component can overcome that.

  FIX 2 (Important - replace fetch(dataUri) with direct Blob construction):
  Instead of fetch('data:...'), use the browser's native atob() with a safety wrapper,
  or better yet, use a TextDecoder approach that avoids the data URI entirely:

    // Safe approach — no fetch, no data URI, no WKWebView restrictions
    const binaryString = atob(content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes.buffer], { type: mime });
    const url = URL.createObjectURL(blob);

  OR for truly large files (>100MB), chunk the atob() processing:

    function base64ToBlob(base64: string, mime: string): Blob {
      const CHUNK = 512;
      const byteArrays: Uint8Array[] = [];
      for (let offset = 0; offset < base64.length; offset += CHUNK) {
        const slice = atob(base64.slice(offset, offset + CHUNK));
        const bytes = new Uint8Array(slice.length);
        for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i);
        byteArrays.push(bytes);
      }
      return new Blob(byteArrays, { type: mime });
    }

  Wait — atob() on slices of base64 won't work because base64 must be decoded in
  complete 4-character groups. The ORIGINAL atob()/charCodeAt() approach was correct.
  The issue was that atob() on the ENTIRE string may fail for very large files.

  Best approach: Use the Uint8Array directly from a decoded ArrayBuffer.
  Modern browsers support: Uint8Array.from(atob(content), c => c.charCodeAt(0))
  Or use a streaming approach via ReadableStream.

  Actually, the simplest robust fix is to keep the atob() approach but add a fallback:
    try {
      // Fast path for most files
      const binaryString = atob(content);
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      blob = new Blob([bytes], { type: mime });
    } catch {
      // Fallback for very large files — use data URI fetch
      const response = await fetch(`data:${mime};base64,${content}`);
      blob = await response.blob();
    }

  FIX 3 (Diagnostic improvement):
  Add console.error logging in both error paths so developers can see the exact error
  in the Tauri dev console:
    console.error('[Viewer3d] Model loading failed:', fetchError);
    console.error('[Viewer3d] model-viewer error:', sourceError);

verification:
files_changed: []
