# Phase 25: Test Infrastructure Foundation - UX/DX Research

**Researched:** 2026-02-08
**Domain:** Developer Experience (DX) for test infrastructure, test ergonomics, organization patterns
**Confidence:** HIGH
**Perspective:** UX / Developer Experience

## Summary

This research examines Phase 25 through the lens of developer experience: how the test infrastructure should feel to use day-to-day, how test files and utilities should be organized for discoverability, how the setup should remain invisible once configured, and how the foundation should accommodate phases 26-30 without any modification.

The FlowForge codebase has **zero existing tests** -- no Vitest config, no test files, no testing libraries installed. This is a greenfield setup opportunity. The project runs React 19.2.4 on Vite 7.3.1 with Zustand 5 for state management, and all backend communication goes through ~70 auto-generated Tauri IPC commands in `bindings.ts`. The DX challenge is creating a test infrastructure that mocks the Tauri boundary convincingly, resets Zustand state automatically, and wraps React components with the necessary providers (QueryClientProvider, MotionConfig) -- all without the developer needing to think about any of it.

**Primary recommendation:** Optimize for "zero-friction test authoring" -- developers should be able to create a `*.test.ts` file next to any source file and start writing assertions immediately, with all mocking, resetting, and provider wrapping handled by shared setup. Test commands should be fast, watch mode should be the default developer workflow, and error messages should point directly to the problem.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- user deferred all implementation decisions to Claude.

### Claude's Discretion

User deferred all implementation decisions to Claude. The following areas are open for Claude to decide during research and planning:

**Mock strategy:**
- How Tauri IPC mocks are structured (factory functions, fixtures, or inline)
- Fidelity level of mock responses relative to real Tauri bindings
- Type-safety approach for mock factories

**Test organization:**
- File placement (co-located vs separate directory)
- Naming convention (*.test.ts vs *.spec.ts)
- Test utility and helper organization

**Coverage & CI expectations:**
- Whether to enforce coverage thresholds in this phase
- Which test types run in CI vs locally only
- Fail-on-regression policy

**Smoke test scope:**
- Which blade types get smoke tests (all vs representative subset)
- Depth of smoke tests (render-only vs basic interaction)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## DX Recommendations for Discretion Areas

### 1. Test File Placement: Co-located (Recommended)

**Recommendation:** Co-locate test files next to source files using `*.test.ts` / `*.test.tsx` naming.

**DX rationale:**
- When a developer opens a source file, the test file is immediately visible in the file tree -- no mental mapping to a separate `__tests__/` directory
- Phase 29 explicitly moves to "blade-centric file structure" with "co-located components, stores, hooks, and **tests** per blade" -- co-locating tests now aligns perfectly
- Vite/Vitest's default `include` pattern already matches `**/*.test.{ts,tsx}` regardless of directory depth
- When refactoring (renaming, moving files), co-located tests move with their source -- no orphaned test files in a parallel directory tree

**Structure example:**
```
src/
  stores/
    blades.ts
    blades.test.ts           # Store logic test
    repository.ts
    repository.test.ts
  components/
    blades/
      BladeRenderer.tsx
      BladeRenderer.test.tsx  # Component smoke test
      SettingsBlade.tsx
      SettingsBlade.test.tsx
  lib/
    errors.ts
    errors.test.ts            # Pure function test
  test/                       # Shared test utilities (NOT test files)
    setup.ts                  # Global Vitest setup
    mocks/
      tauri-ipc.ts            # Tauri IPC mock factories
      zustand.ts              # Zustand auto-reset mock (replaces zustand module)
    helpers/
      render.tsx              # Custom render with providers
      factories.ts            # Test data factories for bindings types
```

**Why NOT a separate `__tests__/` directory:**
- Creates a parallel directory tree that drifts out of sync with source
- Forces developers to mentally map `src/stores/blades.ts` to `__tests__/stores/blades.test.ts`
- Phase 29 would need to move tests anyway to achieve co-location
- No discoverability benefit -- developers already know where the source is

**Confidence:** HIGH -- Vitest docs, React ecosystem conventions, and Phase 29 requirements all align on co-location.

### 2. Naming Convention: `*.test.ts` (Recommended)

**Recommendation:** Use `*.test.ts` and `*.test.tsx` exclusively.

**DX rationale:**
- Vitest's default `include` pattern matches both `.test.` and `.spec.` -- but picking ONE convention prevents confusion about which to use
- `.test.ts` is more common in the React/Vite ecosystem (Create React App, Next.js, Vitest examples all default to `.test.`)
- `.spec.` has stronger associations with BDD-style frameworks (Jasmine, Cypress, Playwright) -- this project does unit/component tests, not BDD specs
- Consistency matters more than the specific choice -- one convention = zero decision fatigue

**Convention table:**
| File | Naming |
|------|--------|
| Unit test for `blades.ts` | `blades.test.ts` |
| Component test for `BladeRenderer.tsx` | `BladeRenderer.test.tsx` |
| Integration test for store + component | `StagingFlow.test.tsx` |
| Test data factory | `factories.ts` (NOT `*.test.ts` -- it's a utility) |
| Test helper/wrapper | `render.tsx` (NOT `*.test.tsx` -- it's a utility) |

**Confidence:** HIGH -- ecosystem convention verified via Context7 (Vitest docs) and community patterns.

### 3. Mock Strategy: Typed Factory Functions at the Module Boundary (Recommended)

**Recommendation:** Use factory functions that return type-safe mock data matching the `bindings.ts` types. Mock at the `@tauri-apps/api/core` invoke level using `@tauri-apps/api/mocks`.

**DX rationale:**
- The `bindings.ts` file is auto-generated by tauri-specta and exports typed `commands` object + all TypeScript types (`RepoStatus`, `GitError`, `StagingStatus`, etc.)
- Factory functions like `mockRepoStatus()` provide autocomplete and type-checking -- developers see exactly what shape the mock data takes
- Mocking at the `invoke` level (via `mockIPC`) means the actual `commands.*` functions still run their real code paths (including the `Result<T, E>` wrapping) -- higher fidelity than mocking the `commands` object directly
- Factories are composable: `mockRepoStatus({ isDirty: true })` overrides just what the test cares about

**Architecture:**
```
src/test/mocks/tauri-ipc.ts     # mockIPC setup + command routing
src/test/helpers/factories.ts   # Type-safe data factories
```

**Mock fidelity level:** Match the `Result<T, E>` pattern from bindings. Every command returns either `{ status: "ok", data: T }` or `{ status: "error", error: E }`. Mock factories should produce these exact shapes. The tauri-specta types are the contract.

**Why NOT inline mocks per test:**
- Duplicated mock data across tests drifts -- one test's mock becomes stale
- No type safety -- inline objects bypass TypeScript checking
- Maintenance burden -- when bindings.ts regenerates with new fields, every inline mock breaks separately

**Why NOT fixture files (JSON):**
- Lose TypeScript type checking
- Can't compute dynamic values (UUIDs, timestamps)
- Harder to compose partial overrides

**Confidence:** HIGH -- Tauri docs confirm `mockIPC` from `@tauri-apps/api/mocks` as the official approach. Factory pattern is standard practice.

### 4. Coverage & CI: No Thresholds in Phase 25, Ratchet Later (Recommended)

**Recommendation:** Do NOT enforce coverage thresholds in Phase 25. Set up coverage reporting (visible), but no gates (blocking).

**DX rationale:**
- Phase 25 is infrastructure -- it adds a handful of example/smoke tests to prove the setup works
- Enforcing thresholds on a codebase with ~0% coverage creates a "wall" -- every phase 26-30 change must also add tests to stay above threshold, which couples unrelated work
- Instead, enable coverage reporting so developers can *see* coverage locally and in CI, then Phase 30 or later can introduce a ratchet (thresholds that only go up)
- The `npm test` command should NOT run coverage by default (slows the feedback loop) -- coverage should be a separate `npm run test:coverage` command

**CI expectations:**
- `npm test` runs in CI on every PR -- fast, no coverage overhead
- `npm run test:coverage` runs on merge to main -- produces report, no threshold gates
- Tests must pass (zero tolerance for failures) -- this IS a gate from day one

**Confidence:** HIGH -- standard industry practice for greenfield test setups.

### 5. Smoke Test Scope: All 13 Blade Types, Render-Only (Recommended)

**Recommendation:** Smoke test ALL blade types (not a subset). Each test verifies "renders without crashing" only.

**DX rationale:**
- The project has exactly 13 blade types (small, fixed set): `staging-changes`, `topology-graph`, `commit-details`, `diff`, `viewer-nupkg`, `viewer-image`, `viewer-markdown`, `viewer-3d`, `viewer-code`, `repo-browser`, `settings`, `changelog`, `gitflow-cheatsheet`
- 13 render-only tests are trivially fast (< 100ms each) and provide a regression safety net for ALL blade types
- A "representative subset" saves nothing (the full set is small) but creates a gap -- the untested blades are exactly the ones that will break silently
- Render-only depth is appropriate: smoke tests verify the component tree doesn't throw, not that interactions work. Interaction tests belong in feature-specific test phases.
- Phase 29 (blade-centric file structure) will move these tests to co-locate with each blade -- having all 13 means every blade directory starts with at least one test

**Smoke test pattern:**
```tsx
// SettingsBlade.test.tsx
import { render } from "@/test/helpers/render";
import { SettingsBlade } from "./SettingsBlade";

describe("SettingsBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<SettingsBlade />);
    expect(container).toBeInTheDocument();
  });
});
```

**Blades requiring special mock setup:**
- `staging-changes`: Needs `useQuery` mock (TanStack React Query) + `commands.getStagingStatus` IPC mock
- `topology-graph`: Needs topology store populated or mocked
- `commit-details`: Needs `oid` prop + IPC mock for `commands.getCommitDetails`
- `viewer-*` blades: Need `filePath` prop + IPC mocks for file content
- `repo-browser`: Needs IPC mock for `commands.listRepoFiles`
- Simpler blades (`settings`, `changelog`, `gitflow-cheatsheet`): Need only Zustand store mocks (auto-reset handles this)

**Confidence:** HIGH -- 13 blade types verified from `BladePropsMap` interface in `bladeTypes.ts`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0 | Test runner | Vite-native, supports Vite 7, zero-config with existing vite.config.ts |
| @testing-library/react | ^16.3 | React component testing | Official React recommendation, React 19 compatible |
| @testing-library/jest-dom | ^6.6 | DOM assertion matchers | `toBeInTheDocument()`, `toHaveTextContent()` etc. |
| jsdom | ^26 (peer) | Browser environment emulation | Required by Vitest for DOM tests, installed as peer of vitest |
| @tauri-apps/api (mocks) | ^2 (existing) | Tauri IPC mocking | Already installed; `@tauri-apps/api/mocks` provides `mockIPC`, `clearMocks` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/user-event | ^14 | Realistic user interaction simulation | Future interaction tests (not needed for Phase 25 smoke tests) |
| @vitest/coverage-v8 | ^4.0 | Code coverage reporting | `npm run test:coverage` command |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom | happy-dom | happy-dom is faster but less spec-compliant; jsdom is the safer default for a Tauri app testing DOM APIs |
| @testing-library/react | Enzyme | Enzyme is unmaintained and doesn't support React 19 |
| vitest | jest | Jest requires additional config for ESM/Vite; Vitest shares vite.config.ts |

**Installation:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

Note: `jsdom` is installed as a peer dependency of vitest when `environment: 'jsdom'` is configured. `@tauri-apps/api` is already a production dependency providing the mocks module.

## Architecture Patterns

### Recommended Test Infrastructure Structure
```
src/
  test/                              # Shared test infrastructure
    setup.ts                         # Global Vitest setup (jest-dom matchers, Tauri clearMocks, crypto polyfill)
    mocks/
      zustand.ts                     # Auto-reset mock (official Zustand pattern)
    helpers/
      render.tsx                     # Custom render with QueryClientProvider + MotionConfig
      factories.ts                   # Type-safe mock data factories for bindings types
      tauri.ts                       # Typed IPC mock helpers (mockCommand, mockCommandError)
  stores/
    blades.test.ts                   # Co-located store test
    repository.test.ts               # Co-located store test
  components/
    blades/
      SettingsBlade.test.tsx          # Co-located smoke test
      BladeRenderer.test.tsx          # Co-located smoke test
  lib/
    errors.test.ts                   # Co-located pure function test
vitest.config.ts                     # Test configuration (separate from vite.config.ts)
```

### Pattern 1: Global Test Setup File

**What:** A single `src/test/setup.ts` that runs before every test file, configuring matchers, clearing mocks, and polyfilling missing browser APIs.

**When to use:** Always -- this is the foundation that makes individual tests clean.

**Why it matters for DX:** Developers never need to write boilerplate in individual test files. No `beforeEach(clearMocks)` per file, no manual matcher imports.

**Example:**
```typescript
// src/test/setup.ts
// Source: Zustand testing guide + Tauri mocking docs + jest-dom docs

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { clearMocks } from "@tauri-apps/api/mocks";

// Auto-mock Zustand for store reset between tests
vi.mock("zustand");

// Polyfill crypto.getRandomValues for jsdom (required by crypto.randomUUID in blade store)
import { randomFillSync } from "node:crypto";
if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      getRandomValues: (buffer: NodeJS.ArrayBufferView) => randomFillSync(buffer),
      randomUUID: () => "00000000-0000-0000-0000-000000000000",
    },
  });
}

// Clean up after each test
afterEach(() => {
  cleanup();        // React Testing Library DOM cleanup
  clearMocks();     // Tauri mock state cleanup
});
```

### Pattern 2: Zustand Auto-Reset Mock (Official Pattern)

**What:** A module-level mock of `zustand` that intercepts `create()`, captures initial state, and resets all stores after each test.

**When to use:** Automatically for every test -- installed via `vi.mock("zustand")` in setup.

**Why it matters for DX:** Zustand stores are singletons. Without auto-reset, test A's state mutations leak into test B. The official Zustand mock pattern solves this transparently -- developers write store tests as if each test gets a fresh store.

**Example:**
```typescript
// src/test/mocks/zustand.ts
// Source: https://github.com/pmndrs/zustand/blob/main/docs/guides/testing.md

import { act } from "@testing-library/react";
import type * as ZustandExportedTypes from "zustand";
export * from "zustand";

const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof ZustandExportedTypes>("zustand");

export const storeResetFns = new Set<() => void>();

const createUncurried = <T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

export const create = (<T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  return typeof stateCreator === "function"
    ? createUncurried(stateCreator)
    : createUncurried;
}) as typeof ZustandExportedTypes.create;

const createStoreUncurried = <T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  const store = actualCreateStore(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

export const createStore = (<T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  return typeof stateCreator === "function"
    ? createStoreUncurried(stateCreator)
    : createStoreUncurried;
}) as typeof ZustandExportedTypes.createStore;

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => resetFn());
  });
});
```

**Critical note for this project:** The `useBladeStore` uses `devtools` middleware wrapping `create()`. The mock intercepts `create()` before middleware is applied, so `devtools` still wraps the mock store. The `import.meta.env.DEV` check inside `devtools({ enabled: import.meta.env.DEV })` may need handling -- Vitest sets `import.meta.env.DEV` to `true` by default, which is correct for test behavior.

### Pattern 3: Custom Render with Providers

**What:** A `render()` function that wraps components in QueryClientProvider and MotionConfig, matching the provider tree in `main.tsx`.

**When to use:** All component tests -- import `render` from `@/test/helpers/render` instead of `@testing-library/react`.

**Why it matters for DX:** Components that use `useQuery` or `useQueryClient` crash without a QueryClientProvider. A custom render means developers never debug "No QueryClient set" errors in tests.

**Example:**
```tsx
// src/test/helpers/render.tsx
// Source: https://testing-library.com/docs/react-testing-library/setup

import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,           // No retries in tests
        gcTime: Infinity,       // Don't garbage collect during test
      },
    },
  });
}

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="always">
        {children}
      </MotionConfig>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything from RTL
export * from "@testing-library/react";
// Override render
export { customRender as render };
```

### Pattern 4: Typed IPC Mock Helpers

**What:** Helper functions that set up `mockIPC` with typed command handlers matching the auto-generated `bindings.ts` signatures.

**When to use:** Any test that exercises code calling `commands.*` from bindings.

**Why it matters for DX:** The `mockIPC` callback receives `(cmd: string, payload?: unknown)` -- no type safety. The helper layer adds types so developers get autocomplete on command names and payload shapes.

**Example:**
```typescript
// src/test/helpers/tauri.ts

import { mockIPC, mockWindows, clearMocks } from "@tauri-apps/api/mocks";
import type { Result, RepoStatus, StagingStatus, GitError } from "../../bindings";

type CommandHandler = (args: Record<string, unknown>) => unknown;
type CommandMap = Record<string, CommandHandler>;

/**
 * Set up Tauri IPC mocking with typed command handlers.
 * Commands not in the map return undefined (simulating unhandled commands).
 */
export function setupTauriMocks(handlers: CommandMap = {}) {
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const handler = handlers[cmd];
    if (handler) {
      const args = (payload as Record<string, unknown>) ?? {};
      return handler(args);
    }
    return undefined;
  });
}

/** Helper: wrap a value in a successful Result */
export function ok<T>(data: T): Result<T, GitError> {
  return { status: "ok", data };
}

/** Helper: wrap an error in a failed Result */
export function err(error: GitError): Result<never, GitError> {
  return { status: "error", error };
}
```

### Pattern 5: Type-Safe Data Factories

**What:** Factory functions that return realistic mock data matching bindings types, with sensible defaults and partial overrides.

**When to use:** When tests need mock data for IPC responses or store state.

**Why it matters for DX:** Developers write `mockRepoStatus({ isDirty: true })` instead of constructing a 4-field object from memory. When bindings regenerate with new required fields, the factory breaks in ONE place (the factory function), not in 50 test files.

**Example:**
```typescript
// src/test/helpers/factories.ts

import type {
  RepoStatus,
  StagingStatus,
  FileChange,
  CommitSummary,
  BranchInfo,
  TagInfo,
  GitError,
} from "../../bindings";

export function mockRepoStatus(overrides: Partial<RepoStatus> = {}): RepoStatus {
  return {
    branchName: "main",
    isDirty: false,
    repoPath: "/tmp/test-repo",
    repoName: "test-repo",
    ...overrides,
  };
}

export function mockStagingStatus(overrides: Partial<StagingStatus> = {}): StagingStatus {
  return {
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides,
  };
}

export function mockFileChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    path: "src/index.ts",
    status: "Modified",
    ...overrides,
  } as FileChange;
}

export function mockGitError(
  type: GitError["type"] = "Internal",
  message = "Test error",
): GitError {
  return { type, message } as GitError;
}

// Additional factories for CommitSummary, BranchInfo, TagInfo, etc.
// as needed by specific tests
```

### Anti-Patterns to Avoid

- **Importing directly from `@testing-library/react` instead of the custom render:** Leads to "No QueryClient set" crashes. The custom render should be the ONLY import path for `render`.
- **Manual `beforeEach` store resets:** The Zustand auto-reset mock handles this. Manual resets indicate the mock isn't installed correctly.
- **Mocking `commands` object directly:** Mock at the `invoke` level via `mockIPC` so that the generated `commands.*` wrappers (including Result unwrapping) still execute. This catches bugs in how stores handle Result types.
- **Test files importing from `@tauri-apps/api/core` directly:** Tests should never need raw `invoke` -- they use `mockIPC` for setup and interact through the public API (stores, hooks, components).
- **Snapshot tests for components:** Snapshots are brittle, hard to review, and don't verify behavior. Use explicit assertions (`toBeInTheDocument`, `toHaveTextContent`) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zustand store reset between tests | Custom afterEach that manually resets each store | Official `zustand` mock pattern (`vi.mock("zustand")`) | Automatically captures initial state of ALL stores, including future ones from phases 26-30 |
| Tauri IPC interception | Custom `window.__TAURI_INTERNALS__` manipulation | `@tauri-apps/api/mocks` (`mockIPC`, `clearMocks`) | Official API, handles internal implementation changes across Tauri updates |
| DOM assertion matchers | Custom `expect.extend()` for DOM checks | `@testing-library/jest-dom/vitest` | 40+ matchers maintained by the testing-library team, TypeScript types included |
| Provider wrapping per test | Copy-paste QueryClientProvider + MotionConfig in every test | Custom render helper (Pattern 3 above) | Single source of truth for the provider tree |
| Browser API polyfills | Manual `window.crypto` patches | Centralized polyfills in `setup.ts` | Runs once, affects all tests, easy to maintain |

**Key insight:** The entire DX goal of Phase 25 is to create infrastructure that future phases consume transparently. Every "don't hand-roll" item is something that would otherwise need to be repeated in every test file phases 26-30 create.

## Common Pitfalls

### Pitfall 1: Zustand `devtools` Middleware + Mock Interaction
**What goes wrong:** The `useBladeStore` wraps its creator in `devtools()` middleware. If the Zustand mock doesn't handle middleware-wrapped stores, `getInitialState()` may return the wrong shape or the reset may not work.
**Why it happens:** The mock intercepts `create()` but `devtools()` is a middleware that transforms the state creator before passing it to `create()`. The mock sees the post-middleware creator.
**How to avoid:** The official Zustand mock from the testing guide handles this correctly -- it intercepts `create` at the module level, and middleware (including `devtools`) calls `create` internally, so the mock captures the final store including middleware-applied state. Verify with a test: `useBladeStore.getState().bladeStack` should have the initial root blade after reset.
**Warning signs:** Tests pass individually but fail when run together; blade stack has stale entries from previous tests.

### Pitfall 2: Missing `crypto.randomUUID()` in jsdom
**What goes wrong:** `BladeStore.pushBlade` calls `crypto.randomUUID()` to generate blade IDs. jsdom does not provide `crypto.randomUUID()` (or even a full `crypto.getRandomValues` implementation).
**Why it happens:** jsdom aims for spec compliance but lags behind newer Web APIs. `crypto.randomUUID()` is relatively new.
**How to avoid:** Polyfill in `setup.ts` using Node's `node:crypto` module. Both `getRandomValues` and `randomUUID` should be provided.
**Warning signs:** `TypeError: crypto.randomUUID is not a function` in any test that pushes a blade.

### Pitfall 3: `import.meta.env` and `import.meta.glob` in Test Context
**What goes wrong:** The blade registration system uses `import.meta.glob` for auto-discovery, and `import.meta.env.DEV` for conditional logic. These are Vite-specific APIs that may not work identically in test context.
**Why it happens:** Vitest does support `import.meta.env` (sets `DEV: true` by default) and `import.meta.glob`, but the glob patterns resolve relative to the file's location. If test setup imports registration files differently than the app entry point, globs may not find the registration modules.
**How to avoid:** For smoke tests, import blade components directly (not through the registration system). The registration system is an integration concern -- smoke tests verify individual components render, not that auto-discovery works. If testing the full blade rendering pipeline, import `registrations/index.ts` explicitly in the test setup.
**Warning signs:** `[BladeRegistry] No registration modules found` warning in test output; `getBladeRegistration(type)` returns undefined.

### Pitfall 4: TanStack React Query Cache Pollution
**What goes wrong:** Tests that use components with `useQuery` share a QueryClient, leading to cached data from test A appearing in test B.
**Why it happens:** If the custom render creates one QueryClient shared across tests, the cache persists.
**How to avoid:** Create a NEW QueryClient for each render call (the custom render pattern above does this). Set `gcTime: Infinity` to prevent garbage collection during the test, but ensure a fresh client per render.
**Warning signs:** Tests pass in isolation but fail when run together; `useQuery` returns stale data.

### Pitfall 5: Tauri Plugin Imports Crashing in jsdom
**What goes wrong:** Imports like `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-store`, and `@tauri-apps/plugin-opener` reference Tauri internals that don't exist in jsdom.
**Why it happens:** These plugins call into `window.__TAURI_INTERNALS__` on import. Without `mockIPC` set up before the import, they crash.
**How to avoid:** Mock these plugin modules in `setup.ts` or via Vitest's module mocking: `vi.mock("@tauri-apps/plugin-dialog")`, `vi.mock("@tauri-apps/plugin-store")`, `vi.mock("@tauri-apps/plugin-opener")`. The stores that use `getStore()` from `src/lib/store.ts` (which imports `@tauri-apps/plugin-store`) will also need this mock.
**Warning signs:** `Cannot find module '@tauri-apps/plugin-store'` or `window.__TAURI_INTERNALS__ is not defined` errors during test startup.

### Pitfall 6: Framer Motion Animations in Tests
**What goes wrong:** Components using `framer-motion` may have asynchronous animations that don't complete during the test, causing act() warnings or assertion failures on intermediate states.
**Why it happens:** Framer Motion uses `requestAnimationFrame` and `setTimeout` internally for animations. jsdom doesn't advance time automatically.
**How to avoid:** The custom render wraps in `<MotionConfig reducedMotion="always">` which disables animations entirely in tests. This matches the production `reducedMotion="user"` behavior for users who prefer reduced motion.
**Warning signs:** `act()` warnings in test output; elements have intermediate transform/opacity values instead of final state.

## Extensibility for Phases 26-30

### Phase 26 (XState Navigation FSM)
**What tests will be added:** XState machine unit tests for guards, transitions, and side effects.
**What Phase 25 must provide:** Nothing extra -- XState machine tests are pure TypeScript logic tests that don't need DOM, mocks, or providers. They use Vitest's `describe`/`it`/`expect` directly. The `vitest.config.ts` and `setup.ts` from Phase 25 handle everything.
**Key insight:** XState machine tests are the simplest kind -- they test pure functions. Phase 25's value here is having `npm test` work at all.

### Phase 27 (Init Repo Blade) + Phase 28 (Conventional Commit Blade)
**What tests will be added:** New blade smoke tests + store tests for new blade-specific stores.
**What Phase 25 must provide:** The custom render, Tauri mock helpers, and data factories. Developers create a `*.test.tsx` file next to the new blade component, import `render` from `@/test/helpers/render`, and write the smoke test. No test infrastructure modifications needed.
**Key insight:** The factory pattern is crucial here. New commands in `bindings.ts` (for git-init, .gitignore templates) will need new factory functions in `factories.ts` -- but that's additive, not modifying existing code.

### Phase 29 (Blade-Centric File Structure)
**What tests will be added:** Tests are *moved*, not added. Co-located tests from Phase 25 move into `blades/{blade-name}/` directories.
**What Phase 25 must provide:** Co-located test files that can be moved by simply changing their directory. The `@/test/helpers/*` import path must be stable across moves.
**Key insight:** This is why co-location is recommended NOW -- Phase 29 is a file reorganization. Starting with tests in `__tests__/` would mean Phase 29 has to move AND restructure them. Starting co-located means Phase 29 just moves them alongside their source files.

### Phase 30 (Store Consolidation & Tech Debt)
**What tests will be added:** Tests for consolidated stores, regression tests for removed dead code.
**What Phase 25 must provide:** The Zustand auto-reset mock handles new stores automatically (any store created with `create()` is captured). Factory functions may need updates as store interfaces change, but the pattern is stable.
**Key insight:** When Phase 30 consolidates 21 stores into ~5 domain stores, the auto-reset mock doesn't need any changes -- it intercepts `create()` regardless of how many stores exist.

## Developer Experience Ergonomics

### npm Scripts (Recommended)
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**DX rationale:**
- `npm test` = watch mode (developer's primary workflow while coding)
- `npm run test:run` = single run (CI and pre-commit)
- `npm run test:coverage` = coverage report (on-demand, not blocking)
- `npm run test:ui` = Vitest browser UI for debugging (optional, but excellent for visual test inspection)

### vitest.config.ts (Recommended)
```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/bindings.ts",           // Auto-generated
          "src/test/**",               // Test infrastructure
          "src/vite-env.d.ts",         // Type declarations
          "src/**/*.test.{ts,tsx}",    // Test files themselves
        ],
      },
    },
  }),
);
```

**DX notes on config choices:**
- `globals: true` -- Enables `describe`, `it`, `expect`, `vi` without imports. Reduces boilerplate in every test file. TypeScript types come from `vitest/globals`.
- `environment: "jsdom"` -- Default for all tests. Pure logic tests still work fine in jsdom (no overhead since jsdom is already loaded).
- `setupFiles` -- Single setup file for all global configuration. Developers never need to configure anything per-test-file.
- `include: ["src/**/*.test.{ts,tsx}"]` -- Explicitly scoped to src. Won't accidentally pick up node_modules or docs tests.
- Coverage excludes `bindings.ts` (auto-generated, untestable via unit tests) and test infrastructure itself.

### TypeScript Configuration for Tests
Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

Or create a separate `tsconfig.test.json` that extends the base config, if the team prefers test-specific TypeScript settings.

### Watch Mode UX
Vitest's watch mode is the primary developer workflow:
- **File change detection:** Vitest re-runs only affected tests when a source file changes (via Vite's module graph)
- **Filter by filename:** Press `f` in terminal to filter tests by filename pattern
- **Filter by test name:** Press `t` to filter by test name pattern
- **Press `a` to re-run all:** Useful after fixing a systemic issue

### Error Message Quality
Vitest + React Testing Library produce good error messages by default:
- Failed `toBeInTheDocument()` shows the actual DOM tree
- Failed `getByRole()` / `getByText()` shows available roles/text in the document
- Vitest's diff output shows expected vs. received with color highlighting

**Custom matcher consideration:** `@testing-library/jest-dom` provides `toBeInTheDocument`, `toHaveTextContent`, `toBeVisible`, `toHaveAttribute`, `toHaveClass`, and ~35 more DOM-specific matchers. These produce much better error messages than generic `expect(element).toBeTruthy()`.

## Sub-Project Extraction Opportunities

The `src/test/` directory is designed as a semi-independent module:

### Module 1: `src/test/mocks/zustand.ts`
- **Independence level:** Fully independent. It's the official Zustand mock pattern with zero project-specific code.
- **Extraction potential:** Could be extracted to a shared package if the team has multiple Zustand projects. Low priority since it's a small, stable file.

### Module 2: `src/test/helpers/factories.ts`
- **Independence level:** Depends on `src/bindings.ts` types only. No runtime dependencies.
- **Extraction potential:** This is the highest-maintenance file as bindings evolve. Keeping it in `src/test/helpers/` (not scattered across test files) centralizes the maintenance burden. Could be auto-generated from bindings types in the future.

### Module 3: `src/test/helpers/render.tsx`
- **Independence level:** Depends on project's provider tree (QueryClient, MotionConfig). Moderate coupling.
- **Extraction potential:** Low -- it's inherently project-specific. But it's a single file that rarely changes.

### Module 4: `src/test/helpers/tauri.ts`
- **Independence level:** Depends on `@tauri-apps/api/mocks` and bindings types. Could be used by any Tauri v2 project.
- **Extraction potential:** MEDIUM -- the `setupTauriMocks` + `ok`/`err` helpers pattern is generic enough for any tauri-specta project. Not worth extracting now, but worth noting if the team creates more Tauri apps.

## Code Examples

### Example 1: Store Logic Test (Zustand)
```typescript
// src/stores/blades.test.ts
import { useBladeStore } from "./blades";

describe("useBladeStore", () => {
  it("starts with staging root blade", () => {
    const state = useBladeStore.getState();
    expect(state.bladeStack).toHaveLength(1);
    expect(state.bladeStack[0].type).toBe("staging-changes");
    expect(state.activeProcess).toBe("staging");
  });

  it("pushes a blade to the stack", () => {
    const { pushBlade } = useBladeStore.getState();
    pushBlade({
      type: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });

    const { bladeStack } = useBladeStore.getState();
    expect(bladeStack).toHaveLength(2);
    expect(bladeStack[1].type).toBe("settings");
  });

  it("resets state between tests (auto-reset verification)", () => {
    // This test runs AFTER the pushBlade test above.
    // If auto-reset works, the stack should be back to 1 blade.
    const { bladeStack } = useBladeStore.getState();
    expect(bladeStack).toHaveLength(1);
  });
});
```

### Example 2: Component Smoke Test
```tsx
// src/components/blades/SettingsBlade.test.tsx
import { render, screen } from "@/test/helpers/render";
import { SettingsBlade } from "./SettingsBlade";

describe("SettingsBlade", () => {
  it("renders without crashing", () => {
    render(<SettingsBlade />);
    expect(screen.getByRole("tablist", { name: /settings categories/i })).toBeInTheDocument();
  });
});
```

### Example 3: Store with Tauri IPC Mock
```typescript
// src/stores/repository.test.ts
import { useRepositoryStore } from "./repository";
import { setupTauriMocks, ok, err } from "@/test/helpers/tauri";
import { mockRepoStatus, mockGitError } from "@/test/helpers/factories";

describe("useRepositoryStore", () => {
  it("opens a repository successfully", async () => {
    setupTauriMocks({
      open_repository: () => mockRepoStatus({ branchName: "develop", isDirty: true }),
    });

    const { openRepository } = useRepositoryStore.getState();
    await openRepository("/path/to/repo");

    const { status, isLoading, error } = useRepositoryStore.getState();
    expect(status?.branchName).toBe("develop");
    expect(status?.isDirty).toBe(true);
    expect(isLoading).toBe(false);
    expect(error).toBeNull();
  });

  it("handles repository open failure", async () => {
    setupTauriMocks({
      open_repository: () => {
        throw mockGitError("NotARepository", "Not a git repository");
      },
    });

    const { openRepository } = useRepositoryStore.getState();
    await expect(openRepository("/bad/path")).rejects.toThrow();

    const { status, error } = useRepositoryStore.getState();
    expect(status).toBeNull();
    expect(error).toContain("Not a git repository");
  });
});
```

### Example 4: Pure Function Test (No Setup Needed)
```typescript
// src/lib/errors.test.ts
import { getErrorMessage } from "./errors";
import type { GitError } from "../bindings";

describe("getErrorMessage", () => {
  it("extracts message from errors with message field", () => {
    const error: GitError = { type: "NotFound", message: "Branch not found" };
    expect(getErrorMessage(error)).toBe("Branch not found");
  });

  it("returns type name for errors without message", () => {
    const error: GitError = { type: "NoStagedChanges" } as GitError;
    expect(getErrorMessage(error)).toBe("NoStagedChanges");
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + babel transforms | Vitest (Vite-native) | 2023+ | No separate build pipeline for tests; shares vite.config.ts |
| Enzyme (shallow render) | React Testing Library (full render) | 2020+ | Tests verify user-observable behavior, not implementation details |
| Manual store reset in afterEach | Zustand auto-reset mock module | Zustand v4+ (2023) | Zero-maintenance state isolation between tests |
| `@testing-library/jest-dom` manual setup | `@testing-library/jest-dom/vitest` import | jest-dom v6+ | Single import replaces manual `expect.extend()` + type config |
| vitest ^3.x (Vite 5/6) | vitest ^4.x (Vite 7 support) | 2025/2026 | Required for this project's Vite 7.3.1 |

**Deprecated/outdated:**
- **Jest:** Not recommended for Vite projects due to ESM/CJS conflicts and duplicate build configuration
- **Enzyme:** Unmaintained, no React 18/19 support
- **`react-test-utils`:** Deprecated by React team in favor of React Testing Library
- **`@testing-library/jest-dom` manual matcher extension:** Replaced by the `/vitest` subpath export

## Open Questions

1. **React 19.2.4 + @testing-library/react ^16.3 peer dependency**
   - What we know: RTL 16.3.2 includes React 19 compatibility fixes. React 19 is relatively new (this project uses 19.2.4).
   - What's unclear: Whether `npm install` will produce peer dependency warnings with this exact React version.
   - Recommendation: Install with `--save-dev` first. If peer dependency warnings appear, they should be non-blocking (RTL 16.3+ works with React 19 at runtime). Use `--legacy-peer-deps` only if `npm install` fails outright.

2. **`import.meta.glob` in test context for blade registration auto-discovery**
   - What we know: Vitest supports `import.meta.glob` since it runs through Vite's transform pipeline.
   - What's unclear: Whether the registration auto-discovery (`registrations/index.ts`) works identically when a test imports a blade component that depends on the registry.
   - Recommendation: For Phase 25 smoke tests, import blade components directly (not through the registry). Add a separate integration test for the registration system if needed in Phase 29.

3. **`@tauri-apps/plugin-store` mocking depth**
   - What we know: The `navigation.ts` store and `theme.ts` store call `getStore()` which imports from `@tauri-apps/plugin-store`. This will fail in jsdom without a mock.
   - What's unclear: Whether a simple `vi.mock("@tauri-apps/plugin-store")` is sufficient or whether a more detailed mock implementation is needed for stores that read persisted values.
   - Recommendation: Start with `vi.mock("@tauri-apps/plugin-store")` which auto-mocks all exports. For stores that need persisted-value reading in tests, provide a manual mock that returns a simple in-memory Map. Test this with the `navigation.test.ts` store test.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/main_vitest_dev` -- Vitest configuration, jsdom environment, reporters, coverage, mergeConfig
- Context7 `/pmndrs/zustand` -- Official Zustand testing guide with Vitest mock pattern, store reset approach
- Context7 `/websites/testing-library` -- React Testing Library custom render pattern, provider wrapping, setup guide
- [Tauri v2 Mock APIs](https://v2.tauri.app/develop/tests/mocking/) -- `mockIPC`, `mockWindows`, `clearMocks` API, event mocking
- [Tauri Mocks API Reference](https://v2.tauri.app/reference/javascript/api/namespacemocks/) -- Function signatures, MockIPCOptions interface

### Secondary (MEDIUM confidence)
- [Vitest Best Practices](https://www.projectrules.ai/rules/vitest) -- Naming conventions, file organization patterns
- [React Testing Library Issue #1364](https://github.com/testing-library/react-testing-library/issues/1364) -- React 19 support status in RTL
- [npm @testing-library/react](https://www.npmjs.com/package/@testing-library/react) -- Version 16.3.2, latest release

### Tertiary (LOW confidence)
- WebSearch on vitest 4 + Vite 7 compatibility -- confirmed Vitest 3.2+ supports Vite 7, so Vitest 4 should fully support it, but exact version constraints not verified from official changelog

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Vitest + RTL + jest-dom is the verified industry standard for Vite + React projects
- Architecture patterns: HIGH -- Zustand mock is from official docs, RTL custom render is from official docs, Tauri mock is from official docs
- DX recommendations: HIGH -- Co-location, naming conventions, and ergonomic patterns are well-established community standards
- Pitfalls: HIGH -- Each pitfall identified from known jsdom limitations, Tauri mock requirements, and Zustand middleware behavior
- Extensibility analysis: MEDIUM -- Based on reading Phase 26-30 requirements, but actual implementation details may surface new needs

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- stable stack, no major version changes expected)
