---
status: complete
started: 2026-02-08
completed: 2026-02-08
---

# Plan 25-02 Summary: Typed Mock Factories & Store Tests

## What Was Built
Typed Tauri IPC mock factories, custom render wrapper, and store tests demonstrating the mocking pattern.

## Key Files Created
- `src/test-utils/mocks/tauri-commands.ts` — ok/err helpers + factories for all bindings types + `createMockCommands()` covering 50+ commands
- `src/test-utils/render.tsx` — Custom render with QueryClientProvider (fresh per call) + MotionConfig
- `src/stores/repository.test.ts` — 4 tests demonstrating `vi.hoisted()` pattern for per-file IPC mocking
- `src/stores/toast.test.ts` — 5 tests verifying crypto.randomUUID polyfill and store operations

## Key Decisions
- **`vi.hoisted()` for mock commands**: `vi.mock()` is hoisted above imports, so mock objects must use `vi.hoisted()` to be available in the factory
- **Inline mock in vi.hoisted()**: Cannot reference imported functions inside `vi.hoisted()` — must define mock objects inline
- **Fresh QueryClient per render**: Prevents cache pollution between tests

## Deviations
- Plan suggested `const mockCommands = createMockCommands()` + `vi.mock()` but Vitest ESM hoisting requires `vi.hoisted()` with inline mock definition

## Self-Check: PASSED
- 14 total tests passing (5 blades + 4 repository + 5 toast)
- Typed mock factories compile without errors
- Factory functions accept Partial<T> overrides
