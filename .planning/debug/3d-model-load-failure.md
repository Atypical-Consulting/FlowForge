---
status: diagnosed
trigger: "Investigate why opening a .glb file from the repo browser shows 'Failed to load 3D model'"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - model-viewer fires error event during updateSource; error detail is swallowed by handler
test: Full code trace from Rust backend through IPC to blob URL to model-viewer internals
expecting: N/A - root cause confirmed with two contributing issues
next_action: Return diagnosis

## Symptoms

expected: Opening a .glb file from repo browser should display a 3D model
actual: Shows "Failed to load 3D model"
errors: "Failed to load 3D model"
reproduction: Open any .glb file from the repo browser
started: Unknown

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
  evidence: Standard widely-used pattern; charCodeAt() correctly returns 0-255 for atob() Latin-1 output
  timestamp: 2026-02-07T00:04:30Z

## Evidence

- timestamp: 2026-02-07T00:00:30Z
  checked: Rust backend read_repo_file (src-tauri/src/git/browse.rs lines 118-178)
  found: Binary files correctly detected and base64-encoded using STANDARD engine (no line breaks). Same encoding used by working get_file_base64.
  implication: Backend data pipeline is correct

- timestamp: 2026-02-07T00:01:00Z
  checked: Viewer3dBlade.tsx error event handler (lines 109-111)
  found: Handler sets generic "Failed to render 3D model" without examining the event object. model-viewer dispatches error events with detail.type='loadfailure' and detail.sourceError=<Error object> (confirmed in model-viewer-base.js line 501). All diagnostic information is discarded.
  implication: Cannot determine exact failure cause from user-facing error. This is the primary diagnostic bug.

- timestamp: 2026-02-07T00:02:00Z
  checked: model-viewer-base.js updateSource method (lines 464-506)
  found: updateSource runs Promise.all([srcUpdated, envUpdated]) at line 484. If EITHER the model source loading OR the environment update fails, the catch fires the error event. environment update can throw from environment.js line 118 if WebGL environment generation fails.
  implication: Error may not be from model data at all -- could be environment/WebGL initialization failure

- timestamp: 2026-02-07T00:03:00Z
  checked: environment.js lines 87-124
  found: $updateEnvironment calls textureUtils.generateEnvironmentMapAndSkybox() with "neutral" as environmentImage. If this throws, the error re-throws (line 118) and propagates to the error event dispatch.
  implication: environment-image="neutral" could be the trigger if WebGL setup fails in Tauri WebView

- timestamp: 2026-02-07T00:04:00Z
  checked: model-viewer shouldAttemptPreload (base line 419)
  found: Requires this[$isElementInViewport] to be true (uses IntersectionObserver). If element is not detected as visible, model won't attempt to load at all (no error, just never loads).
  implication: If IntersectionObserver fails in Tauri WebView, model stays in loading state, NOT error state

- timestamp: 2026-02-07T00:05:00Z
  checked: MarkdownImage.tsx (working comparison)
  found: Uses data URI approach: `data:${mime};base64,${content}`. Does NOT use atob()/charCodeAt()/Blob/ObjectURL chain. Works correctly for binary images from same backend.
  implication: Alternative approach exists and is proven to work with this backend

## Resolution

root_cause: |
  TWO ROOT CAUSES working together:

  1. ERROR SWALLOWING (Viewer3dBlade.tsx line 109-111): The model-viewer error event handler
     discards ALL diagnostic information. model-viewer dispatches errors with
     `{ detail: { type: 'loadfailure', sourceError: <Error> } }` (confirmed in
     node_modules/@google/model-viewer/lib/model-viewer-base.js line 501), but the handler
     ignores the event entirely and sets a generic string. This makes it impossible to
     diagnose the actual failure from the user-facing error alone.

  2. FRAGILE LOADING PIPELINE (Viewer3dBlade.tsx lines 53-65): The base64 -> atob() ->
     charCodeAt() -> Uint8Array -> Blob -> ObjectURL chain is mechanically correct but
     unnecessarily complex and fragile. While the atob()/charCodeAt() pattern works in
     theory, large GLB files may cause atob() to throw DOMException due to string size
     limits. Additionally, model-viewer's updateSource() runs Promise.all([srcUpdated,
     envUpdated]), meaning ANY failure in environment initialization (e.g., WebGL context
     issues in Tauri's WKWebView) triggers the same error event as a model load failure.

  The combination means: something fails during model-viewer's load/environment initialization,
  the error event fires, and all useful error information is discarded. The user sees only
  "Failed to load 3D model" with no way to determine whether it's a data issue, WebGL issue,
  or environment image issue.

fix: |
  FIX 1 (Critical - capture diagnostics): Update the error event handler at line 109-111:
    const onError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sourceError = detail?.sourceError;
      const msg = sourceError?.message || detail?.type || "Failed to render 3D model";
      setFetchError(msg);
    };

  FIX 2 (Robustness - simplify decode chain): Replace atob()/charCodeAt() with fetch-based
  approach that leverages browser-native base64 decoding:
    const dataUri = `data:model/gltf-binary;base64,${content}`;
    const response = await fetch(dataUri);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

  FIX 3 (Optional - remove environment failure mode): If the environment is not essential,
  remove environment-image="neutral" or wrap model-viewer in a try/catch that retries
  without the environment attribute on failure.

verification:
files_changed: []
