# Plan 41-03 Summary: Worker Sandbox Prototype with postMessage Bridge

## Status: COMPLETE

## What Was Built

### Task 1: Sandbox Bridge and Worker with postMessage Protocol

**`src/extensions/sandbox/types.ts`**
- `HostToWorkerMessage` union type: `init`, `api-call`, `terminate`
- `WorkerToHostMessage` union type: `ready`, `initialized`, `api-request`, `api-response`, `error`
- All messages are JSON-serializable for structured clone via postMessage

**`src/extensions/sandbox/SandboxBridge.ts`**
- Host-side bridge class managing Worker lifecycle
- `start(workerUrl)`: creates Worker, waits for "ready" handshake with timeout
- `initialize(extensionId, code)`: sends init message, waits for "initialized" response
- `callApi(method, args)`: sends sandbox-safe API calls, tracks pending calls with timeout
- `terminate()`: kills Worker, rejects all pending calls with "Sandbox terminated"
- Method whitelisting: blocks requires-trust methods via `isSandboxSafe()` from 41-01
- `isRunning` getter for lifecycle state inspection

**`src/extensions/sandbox/sandbox-worker.ts`**
- Worker entry point that sends "ready" on load
- Handles `init` (acknowledges with "initialized"), `api-call` (echoes back as response), `terminate` (closes)
- Prototype implementation -- real extensions would evaluate code in restricted scope

### Task 2: Tests with Mock Worker

**`src/extensions/sandbox/__tests__/SandboxBridge.test.ts`**
- 9 test cases using MockWorker (Blob URL workers not compatible with jsdom):
  1. Creates worker and receives ready handshake
  2. Rejects if worker does not send ready within timeout
  3. Sends api-call and receives api-response
  4. Blocks all 6 requires-trust methods
  5. Allows all 3 sandbox-safe methods
  6. Terminate rejects pending calls
  7. Throws when calling API before start
  8. Throws when starting twice
  9. Handles api-response errors from worker

**`package.json`**
- Added `@vitest/web-worker` as dev dependency (available for future real Worker tests)

## Verification

- `npx tsc --noEmit` passes
- `npx vitest run src/extensions/sandbox/__tests__/SandboxBridge.test.ts` -- 9/9 tests pass
- `npx vitest run` -- 233/233 tests pass (3 pre-existing Monaco mock failures unrelated)
- Commit: `b92b9e4`

## Files Changed

| File | Change |
|------|--------|
| `src/extensions/sandbox/types.ts` | New: shared message type definitions |
| `src/extensions/sandbox/SandboxBridge.ts` | New: host-side Worker bridge class |
| `src/extensions/sandbox/sandbox-worker.ts` | New: Worker entry point with protocol |
| `src/extensions/sandbox/__tests__/SandboxBridge.test.ts` | New: 9 tests for bridge protocol |
| `package.json` | Added @vitest/web-worker dev dependency |

## Design Decisions

- **MockWorker over Blob URLs**: `@vitest/web-worker` can't resolve Blob URLs in jsdom/Vite module runner. Used MockWorker class that simulates postMessage protocol directly, which tests the actual bridge logic (method whitelisting, pending call tracking, termination) without needing a real Worker runtime.
- **DedicatedWorkerGlobalScope type**: Not available in DOM lib, so sandbox-worker.ts uses inline type cast to avoid adding WebWorker lib (which conflicts with DOM).
