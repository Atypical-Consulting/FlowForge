---
status: diagnosed
trigger: "3D model loading fails silently in Viewer3dBlade — user sees 'Failed to load 3D model' but no console errors"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:01:00Z
---

## Current Focus

hypothesis: Multiple bugs combine to cause silent failure — missing try/catch around GLTFLoader.parse(), missing abort flag for StrictMode, fetchError in deps causing feedback loop
test: Code analysis complete, all paths traced
expecting: Fix all three bugs
next_action: Report findings

## Symptoms

expected: 3D model renders in the viewer after loading from git
actual: "Failed to load 3D model" message displayed, no console errors
errors: No errors visible in console (errors swallowed)
reproduction: Open any .glb/.gltf file in the Viewer3dBlade
started: After rewrite from @google/model-viewer to Three.js + GLTFLoader (plan 22-21)

## Eliminated

- hypothesis: base64 decoding is incorrect
  evidence: atob + Uint8Array loop is standard and correct; Rust backend uses STANDARD base64 engine which matches atob expectations
  timestamp: 2026-02-08T00:00:30Z

- hypothesis: Uint8Array.buffer returns wrong type
  evidence: Tested — bytes.buffer IS instanceof ArrayBuffer, byteOffset=0, byteLength matches
  timestamp: 2026-02-08T00:00:35Z

- hypothesis: useRepoFile hook has issues
  evidence: Component doesn't use useRepoFile — it calls commands.readRepoFile directly
  timestamp: 2026-02-08T00:00:10Z

- hypothesis: bufferRef temporal dead zone
  evidence: bufferRef is declared after loadModel useCallback but closure captures binding not value; by execution time it's initialized
  timestamp: 2026-02-08T00:00:40Z

- hypothesis: TextEncoder/TextDecoder mismatch for .gltf files
  evidence: TextEncoder.encode().buffer returns valid ArrayBuffer; GLTFLoader.parse correctly handles ArrayBuffer of JSON text via textDecoder.decode
  timestamp: 2026-02-08T00:00:45Z

## Evidence

- timestamp: 2026-02-08T00:00:10Z
  checked: All setFetchError call sites
  found: 5 places set fetchError; only 2 do so WITHOUT console.error (line 51 WebGL check, line 64 readRepoFile error)
  implication: If user sees error with no console output, it's either WebGL fail or readRepoFile error

- timestamp: 2026-02-08T00:00:20Z
  checked: GLTFLoader.parse() source (three.js 0.182.0)
  found: JSON.parse calls on lines 426, 445, 449 of GLTFLoader.js are NOT wrapped in try/catch; synchronous exceptions bypass onError callback
  implication: If base64 data is corrupted, parse throws synchronously and error callback never fires

- timestamp: 2026-02-08T00:00:25Z
  checked: GLTFParser.parse() on line 2714 of GLTFLoader.js
  found: Internal Promise chain has .catch(onError) — async errors ARE routed to callback
  implication: Only synchronous exceptions in the outer parse() method bypass the callback

- timestamp: 2026-02-08T00:00:30Z
  checked: React StrictMode in main.tsx
  found: StrictMode enabled — effects run twice (setup, cleanup, setup)
  implication: Two loadModel() calls run concurrently; Three.js effect setup/cleanup/setup can cause stale parse callbacks

- timestamp: 2026-02-08T00:00:35Z
  checked: Second useEffect dependency array [loading, fetchError]
  found: fetchError in deps causes effect re-run when parse error callback fires; creates cleanup+re-run cycle
  implication: fetchError shouldn't be a dependency — only needed in guard, not consumed by effect body

- timestamp: 2026-02-08T00:00:40Z
  checked: loadModel missing abort/cleanup
  found: No AbortController, no cancelled flag, no cleanup return from first useEffect
  implication: Under StrictMode, two loadModel() calls race; stale one can overwrite bufferRef or trigger state updates after cleanup

- timestamp: 2026-02-08T00:00:50Z
  checked: BladeErrorBoundary (wraps blades)
  found: Error boundary shows "Something went wrong in 'TITLE'" with componentDidCatch logging — different from user's reported message
  implication: Uncaught synchronous exceptions would show error boundary UI, not BladeContentError

## Resolution

root_cause: Three interacting bugs in the Three.js rewrite: (1) GLTFLoader.parse() can throw synchronous exceptions not caught by onError callback AND not caught by any try/catch in the useEffect body, (2) No abort/cancelled flag for loadModel means StrictMode double-invokes produce racing async operations, (3) fetchError in the Three.js effect dependency array causes unnecessary cleanup/re-setup cycles that can race with in-flight GLTF parse operations.

fix: See detailed fix below
verification: pending
files_changed: [src/components/blades/Viewer3dBlade.tsx]
