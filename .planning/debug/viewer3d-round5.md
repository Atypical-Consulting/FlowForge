---
status: investigating
trigger: "Viewer3dBlade fails to load 3D models — user sees 'Failed to load 3D model' error, no console errors"
created: 2026-02-08T12:00:00Z
updated: 2026-02-08T12:30:00Z
---

## Current Focus

hypothesis: The failure is in Tauri's WKWebView environment, not in the code logic itself; needs isolation testing with standalone HTML page
test: Create standalone HTML page that replicates exact same data pipeline (base64 decode -> ArrayBuffer -> GLTFLoader.parse -> Three.js render)
expecting: If standalone page works with same data, root cause is Tauri/WKWebView environment; if it fails, root cause is in data pipeline or Three.js usage
next_action: User to test standalone HTML page with Playwright MCP

## Symptoms

expected: User opens .glb file from repo browser, 3D model renders in interactive viewer
actual: "Failed to load 3D model" error displayed
errors: No errors visible in console
reproduction: Open any .glb file from the repo browser in Viewer3dBlade
started: After rewrite from @google/model-viewer to Three.js + GLTFLoader (plan 22-21); persists through 5 fix rounds

## Eliminated

- hypothesis: Base64 decoding logic is incorrect
  evidence: atob + Uint8Array charCodeAt loop is the standard pattern; Rust backend uses base64::STANDARD which matches atob expectations
  timestamp: 2026-02-08T12:05:00Z

- hypothesis: Uint8Array.buffer returns wrong type or detached buffer
  evidence: new Uint8Array(n).buffer always returns a valid ArrayBuffer; no transfer/detach occurs
  timestamp: 2026-02-08T12:06:00Z

- hypothesis: GLTFLoader.parse() silently swallows errors
  evidence: Component has try/catch around parse (lines 218-265) catching sync errors, AND error callback (lines 248-256) catching async errors; both call console.error
  timestamp: 2026-02-08T12:07:00Z

- hypothesis: Blade registration or routing is wrong
  evidence: fileDispatch.ts correctly maps "glb" -> "viewer-3d"; registration lazy-imports and wraps correctly
  timestamp: 2026-02-08T12:08:00Z

- hypothesis: React StrictMode double-invocation causes race condition
  evidence: First useEffect has abort flag (lines 114-126); second useEffect has disposed flag (line 136); bufferRef is not detached between runs
  timestamp: 2026-02-08T12:09:00Z

- hypothesis: useRepoFile hook has issues
  evidence: Component does NOT use useRepoFile; it calls commands.readRepoFile directly
  timestamp: 2026-02-08T12:10:00Z

- hypothesis: TextEncoder/TextDecoder mismatch for .gltf text files
  evidence: TextEncoder.encode().buffer returns valid ArrayBuffer; GLTFLoader handles both binary and JSON ArrayBuffer correctly
  timestamp: 2026-02-08T12:11:00Z

- hypothesis: Canvas element missing when Three.js effect fires
  evidence: When loading=false, render path shows canvas (lines 434-443); useEffect fires AFTER render, so canvasRef.current is set
  timestamp: 2026-02-08T12:12:00Z

## Evidence

- timestamp: 2026-02-08T12:01:00Z
  checked: All setFetchError call sites that do NOT log to console.error
  found: Only 2 paths set fetchError WITHOUT console.error — (1) line 53 WebGL check failure, (2) line 66 readRepoFile error status
  implication: "No errors in console" means the failure is at WebGL detection or the Tauri readRepoFile command, NOT in GLTFLoader parsing

- timestamp: 2026-02-08T12:02:00Z
  checked: Full data flow from Tauri backend through JS
  found: Pipeline is Rust read_repo_file (git2 blob read -> binary detect via null byte -> base64::STANDARD.encode) -> JS atob() -> Uint8Array -> .buffer -> GLTFLoader.parse(arrayBuffer, "", onLoad, onError)
  implication: Pipeline is logically correct; each step uses standard patterns

- timestamp: 2026-02-08T12:03:00Z
  checked: GLTFLoader.parse() source (three.js 0.182.0, lines 417-538)
  found: parse() checks instanceof ArrayBuffer (line 428), reads magic header (line 430), creates GLTFBinaryExtension for GLB (line 436), parses JSON content (line 445), creates GLTFParser (line 466), calls parser.parse(onLoad, onError) (line 536)
  implication: All synchronous exceptions in parse() would be caught by the try/catch wrapper at lines 258-262 in Viewer3dBlade

- timestamp: 2026-02-08T12:04:00Z
  checked: Previous debug sessions (3 files found)
  found: viewer3d-silent-fail.md (diagnosed 3 bugs, all fixed in 22-23), 3d-model-wave7.md (diagnosed model-viewer WKWebView issues, led to Three.js rewrite in 22-21), 3d-model-load-failure.md (original investigation)
  implication: Known bugs have been addressed; remaining issue is likely environmental (Tauri WKWebView)

- timestamp: 2026-02-08T12:05:00Z
  checked: Render guard logic at lines 352-374
  found: Guard chain is if(loading)->Loading, if(fetchError)->Error, if(!bufferRef)->Empty. The "Failed to load 3D model" message at line 359 ONLY shows when fetchError is non-null. User sees THIS message specifically.
  implication: fetchError IS being set, but the detail text would reveal WHICH path (WebGL error vs readRepoFile error)

- timestamp: 2026-02-08T12:06:00Z
  checked: Container layout — does canvas get zero dimensions?
  found: Container has class "h-full overflow-hidden relative" (line 434), canvas has style width:100%/height:100%. If parent blade panel has zero height, getBoundingClientRect() at line 146 returns 0x0, renderer is 0x0. But this wouldn't cause fetchError — model would still "load" but be invisible.
  implication: Zero-dimension rendering is a potential UX issue but NOT the cause of the "Failed to load" error message

- timestamp: 2026-02-08T12:07:00Z
  checked: Whether readRepoFile could fail for .glb files specifically
  found: Rust backend does null-byte detection (line 160-161) — .glb files always contain null bytes so is_binary=true. Base64 encoding is done on entire blob content (line 164-165). No size limit on Tauri IPC, but very large files may cause OOM in atob().
  implication: For typical .glb files (1-50MB), the pipeline should work; for very large files, atob() could fail

- timestamp: 2026-02-08T12:08:00Z
  checked: No .glb or .gltf files exist in FlowForge repository
  found: Glob for **/*.glb and **/*.gltf returned no results
  implication: Cannot reproduce in this repo; must test in a repo that contains 3D model files

## Resolution

root_cause: |
  INCONCLUSIVE — Code logic analysis shows the data pipeline is correct.

  The "no console errors" symptom narrows the failure to two paths:

  1. **WebGL detection failure (line 48-56):** If WebGL is not available in Tauri's
     WKWebView, fetchError is set to "WebGL is not supported by your browser or GPU"
     with NO console.error. This is the MOST LIKELY cause.

  2. **readRepoFile returns error (line 64-68):** If the Tauri command fails (file not
     found at HEAD, repo not open, path mismatch), fetchError is set to the git error
     message with NO console.error.

  CRITICAL OBSERVATION: The user-visible error message says "Failed to load 3D model"
  (the `message` prop at line 359), but the `detail` prop at line 360 shows the ACTUAL
  `fetchError` value. The detail text would disambiguate:
  - "WebGL is not supported..." → WebGL issue
  - "PathNotFound: ..." → file path issue
  - "No repository open" → repo state issue

  The THREE.JS CODE ITSELF IS CORRECT. The GLTFLoader.parse() usage, the scene setup,
  the cleanup, the StrictMode handling — all are logically sound. The 5 bugs fixed in
  plan 22-23 addressed real issues. The remaining problem is environmental or data-related,
  not code-logic related.

  RECOMMENDATION: The user's instinct to create a standalone HTML page is the RIGHT
  approach. This isolates:
  - Three.js + GLTFLoader functionality (does it work at all?)
  - Base64 decode pipeline (does atob → Uint8Array → ArrayBuffer → parse work?)
  - WebGL availability (can we create a WebGLRenderer?)
  - The actual GLB data (is the test file valid?)

fix: |
  IMMEDIATE DIAGNOSTIC IMPROVEMENTS (apply to Viewer3dBlade.tsx):

  1. Add console.error to the two silent failure paths:
     - Line 53: Add console.error("[Viewer3dBlade] WebGL not supported") before setFetchError
     - Line 66: Add console.error("[Viewer3dBlade] readRepoFile failed:", result.error) before setFetchError

  2. Add telemetry logging at key pipeline stages:
     - After readRepoFile succeeds: log content.length, isBinary, size
     - After base64 decode: log arrayBuffer.byteLength
     - After bufferRef set: log "buffer ready"
     - In second useEffect: log "Three.js setup starting"
     - In GLTFLoader onLoad: log "model parsed successfully"

  3. Create standalone HTML page (see .planning/debug/viewer3d-standalone.html)
     for isolated testing with Playwright MCP

verification: pending — user must test with standalone page and check actual detail text in error message
files_changed: []

## Specific Code Issues Found

### Issue 1: Silent failure paths (HIGH PRIORITY)
File: src/components/blades/Viewer3dBlade.tsx
Lines: 48-56 and 63-68

Two paths set `fetchError` WITHOUT any `console.error` output. This makes debugging
impossible when the error occurs at these points. The user sees "Failed to load 3D model"
but the console is empty, hiding the actual cause.

```typescript
// Line 48-56: WebGL check — NO console.error
if (!gl) {
  setFetchError("WebGL is not supported by your browser or GPU");
  setLoading(false);
  return;
}

// Line 64-68: readRepoFile error — NO console.error
if (result.status !== "ok") {
  setFetchError(getErrorMessage(result.error));
  setLoading(false);
  return;
}
```

FIX: Add console.error before each setFetchError call.

### Issue 2: fetchError detail not prominently visible (MEDIUM PRIORITY)
File: src/components/blades/Viewer3dBlade.tsx
Lines: 357-364

The BladeContentError component shows "Failed to load 3D model" as the primary message
and the actual fetchError as a small, dimmed detail text. If the detail text says
"WebGL is not supported," that's critical information hidden in small overlay-colored text.

### Issue 3: No telemetry logging in success path (LOW PRIORITY)
File: src/components/blades/Viewer3dBlade.tsx

The success path has ZERO logging. We can't tell from the console whether readRepoFile
succeeded, base64 decode completed, buffer was stored, or Three.js setup started.
This makes it impossible to isolate which stage fails.

## Standalone HTML Page

A standalone HTML page has been created at:
`.planning/debug/viewer3d-standalone.html`

This page:
1. Tests WebGL availability
2. Allows loading a .glb file via file input
3. Runs the EXACT same pipeline: FileReader → ArrayBuffer → GLTFLoader.parse → Three.js render
4. Also tests the base64 round-trip: ArrayBuffer → base64 → atob → Uint8Array → ArrayBuffer → parse
5. Logs every step to an on-screen console
6. Can be opened in any browser or Playwright for testing

## Next Steps

1. **Check the detail text**: When the user sees "Failed to load 3D model," what does
   the smaller detail text below it say? This is the ACTUAL error message.

2. **Apply diagnostic logging**: Add console.error to the two silent paths (lines 53, 66).

3. **Test standalone page**: Open viewer3d-standalone.html in Safari/browser to verify
   Three.js + GLTFLoader works outside Tauri.

4. **Test in Tauri webview**: Load the standalone page in Tauri's WKWebView to check
   WebGL availability.

5. **If WebGL is the issue**: Consider fallback messaging or alternative rendering approach.
