# Phase 47: Cleanup & Verification - Expert Developer Research

**Researched:** 2026-02-11
**Domain:** Extension architecture cleanup, test coverage, module boundary enforcement
**Confidence:** HIGH

## Summary

Phase 47 is a cleanup and verification phase following the extraction of three features (topology, init-repo, worktrees) into the extension system. The codebase is already in good shape: old `src/blades/` and `src/components/worktree/` directories have been fully removed (no empty directories found). The primary work is: (1) splitting `_discovery.ts` EXPECTED_TYPES into CORE vs EXTENSION lists, (2) writing toggle tests for topology, init-repo, and worktrees extensions, (3) creating a topology README, and (4) addressing cross-extension import violations that weaken module boundaries.

**Primary recommendation:** Focus on the `_discovery.ts` split, toggle test implementation for 3 new extensions, and adding boundary enforcement via ESLint `no-restricted-imports` rules or a custom lint script.

## Expert Developer Research: Phase 47 Cleanup & Verification

---

### Concrete Cleanup Inventory (file paths)

**Confidence: HIGH** (verified by filesystem inspection)

#### CLEAN-01: Empty Source Directories

No empty directories exist under `src/`. The old locations have been fully removed:
- `src/blades/` -- **does not exist** (all blades moved to `src/core/blades/` or `src/extensions/`)
- `src/components/worktree/` -- **does not exist** (moved to `src/extensions/worktrees/`)

**Result: CLEAN-01 is already satisfied.** No files to delete.

#### Stale Comment/Re-export to Clean Up

| File | Issue | Action |
|------|-------|--------|
| `src/extensions/init-repo/components/index.ts` | Contains only `// InitRepoBlade moved to ../blades/InitRepoBlade.tsx` | Either delete the file or repurpose it to export the actual components (`CategoryFilter`, `InitRepoForm`, `TemplatePicker`, `ProjectDetectionBanner`, `InitRepoPreview`, `TemplateChips`) |

#### Missing README

| Extension | Has README | Action |
|-----------|-----------|--------|
| topology | **No** | Create `src/extensions/topology/README.md` following the pattern from other extensions |
| welcome-screen | Yes | Already has README |
| init-repo | Yes | Already has README |
| worktrees | Yes | Already has README |

#### Cross-Extension Import Violations (Module Boundary Issues)

These imports cross extension boundaries, creating hidden dependencies:

| From (importer) | To (imported) | What's imported |
|-----------------|---------------|-----------------|
| `src/extensions/topology/lib/layoutUtils.ts` | `src/extensions/conventional-commits/lib/conventional-utils` | `parseConventionalMessage` |
| `src/extensions/topology/components/CommitBadge.tsx` | `src/extensions/conventional-commits/lib/commit-type-theme` | `COMMIT_TYPE_THEME`, `ConventionalCommitType` |
| `src/core/lib/commitClassifier.ts` | `src/extensions/conventional-commits/lib/conventional-utils` | `parseConventionalMessage` |
| `src/core/components/icons/CommitTypeIcon.tsx` | `src/extensions/conventional-commits/lib/commit-type-theme` | theme data |
| `src/core/components/commit/CommitForm.tsx` | `src/extensions/conventional-commits/hooks/useAmendPrefill` | `useAmendPrefill` |
| `src/core/components/commit/CommitForm.tsx` | `src/extensions/conventional-commits/components/ConventionalCommitForm` | `ConventionalCommitForm` |
| `src/core/blades/extension-manager/components/ExtensionCard.tsx` | `src/extensions/github/components/ToggleSwitch` | `ToggleSwitch` |
| `src/core/blades/extension-manager/components/ExtensionCard.tsx` | `src/extensions/github/components/PermissionBadge` | `PermissionBadge` |
| `src/core/blades/extension-manager/components/InstallExtensionDialog.tsx` | `src/extensions/github/components/PermissionBadge` | `PermissionBadge` |
| `src/core/blades/extension-detail/ExtensionDetailBlade.tsx` | `src/extensions/github/components/ToggleSwitch` | `ToggleSwitch` |

**Analysis:** The `parseConventionalMessage` and `COMMIT_TYPE_THEME` functions are used by both core and the topology extension. These should arguably live in `src/core/lib/` since core already depends on them. The `ToggleSwitch` and `PermissionBadge` components from the GitHub extension are used by core extension-manager blades -- these should be moved to `src/core/components/`.

**Recommendation for Phase 47:** Document these violations. Moving them is optional for this phase but should be noted as tech debt. At minimum, add lint rules to prevent new violations.

---

### Discovery Types Refactoring (code patterns)

**Confidence: HIGH** (verified by reading `_discovery.ts` and all registration files)

#### Current State

File: `src/core/blades/_discovery.ts`

```typescript
const EXPECTED_TYPES: string[] = [
  "staging-changes", "commit-list-fallback", "commit-details", "diff",
  "branch-manager", "repo-browser", "settings",
  "extension-manager", "extension-detail",
];
```

These 9 types have registration files under `src/core/blades/*/registration.ts`. The discovery module uses `import.meta.glob("./*/registration.{ts,tsx}")` to eagerly load them.

#### What Blade Types Exist Now

**Core blades** (registered via `src/core/blades/*/registration.ts`):
1. `staging-changes`
2. `commit-list-fallback`
3. `commit-details`
4. `diff`
5. `branch-manager`
6. `repo-browser`
7. `settings`
8. `extension-manager`
9. `extension-detail`

**Extension blades** (registered via `onActivate()` in each extension's `index.ts`):
1. `topology-graph` (topology, coreOverride)
2. `conventional-commit` (conventional-commits, coreOverride)
3. `changelog` (conventional-commits, coreOverride)
4. `init-repo` (init-repo, coreOverride)
5. `welcome-screen` (welcome-screen, coreOverride)
6. `gitflow-cheatsheet` (gitflow, coreOverride)
7. `viewer-code` (viewer-code, coreOverride)
8. `viewer-markdown` (viewer-markdown, coreOverride)
9. `viewer-3d` (viewer-3d, coreOverride)
10. `viewer-image` (viewer-image, coreOverride)
11. `viewer-nupkg` (viewer-nupkg, coreOverride)
12. `viewer-plaintext` (viewer-plaintext, coreOverride)
13. `ext:github:sign-in`, `ext:github:account`, etc. (github, NO coreOverride)

#### Proposed CLEAN-02 Implementation

```typescript
import { clearCoreRegistry, getAllBladeTypes } from "../lib/bladeRegistry";

// Single-glob: scan per-blade registration files
const modules = import.meta.glob(
  ["./*/registration.{ts,tsx}", "!./_shared/**"],
  { eager: true }
);

// Guard against misconfigured paths
if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error("[BladeRegistry] No registration modules found -- check src/core/blades/*/registration.{ts,tsx}");
}

// Dev-mode exhaustiveness check
if (import.meta.env.DEV && !import.meta.hot?.data?.isUpdate) {
  const registered = new Set(getAllBladeTypes());

  /** Blade types that MUST be registered by core (always present) */
  const CORE_TYPES: string[] = [
    "staging-changes", "commit-list-fallback", "commit-details", "diff",
    "branch-manager", "repo-browser", "settings",
    "extension-manager", "extension-detail",
  ];

  /** Blade types registered by built-in extensions (present when extension is active) */
  const EXTENSION_TYPES: string[] = [
    "topology-graph", "conventional-commit", "changelog",
    "init-repo", "welcome-screen", "gitflow-cheatsheet",
    "viewer-code", "viewer-markdown", "viewer-3d",
    "viewer-image", "viewer-nupkg", "viewer-plaintext",
  ];

  // Core types must always be present
  const missingCore = CORE_TYPES.filter(t => !registered.has(t as any));
  if (missingCore.length > 0) {
    console.warn(
      `[BladeRegistry] Missing CORE registrations: ${missingCore.join(", ")}. ` +
      `Create a registration.ts in src/core/blades/{blade-name}/ for each.`
    );
  }

  // Extension types are informational only (extensions may be disabled)
  const missingExt = EXTENSION_TYPES.filter(t => !registered.has(t as any));
  if (missingExt.length > 0) {
    console.info(
      `[BladeRegistry] Extension blade types not yet registered: ${missingExt.join(", ")}. ` +
      `These will appear when their extensions activate.`
    );
  }
}

// HMR: clear registry before re-execution so re-registration is clean
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearCoreRegistry();
  });
}
```

**Key changes:**
1. Split `EXPECTED_TYPES` into `CORE_TYPES` (must-have, `console.warn`) and `EXTENSION_TYPES` (informational, `console.info`)
2. Core missing = warning (indicates broken build), Extension missing = info (normal if disabled)
3. No behavioral change -- this is purely a dev-mode diagnostic improvement

---

### Toggle Test Implementation Patterns

**Confidence: HIGH** (verified by reading existing test files and extension entry points)

#### Extensions Needing Toggle Tests (CLEAN-03)

1. **topology** -- registers blade (`topology-graph`), command (`show-topology`), file watcher disposable
2. **init-repo** -- registers blade (`init-repo`), command (`init-repository`), store reset disposable
3. **worktrees** -- registers sidebar panel (`worktree-panel`), 2 commands (`create-worktree`, `refresh-worktrees`)

#### Existing Test Pattern (established by conventional-commits, viewer-*, gitflow, github)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { onActivate, onDeactivate } from "../{extension-name}";

describe("{extension-name} extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("{extension-id}");
  });

  // Registration tests
  it("registers {type} blade type on activation", async () => {
    await onActivate(api);
    expect(getBladeRegistration("{type}")).toBeDefined();
    api.cleanup();
  });

  // Namespace tests (coreOverride or ext: prefix)
  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);
    expect(getBladeRegistration("ext:{id}:{type}")).toBeUndefined();
    api.cleanup();
  });

  // Cleanup tests (THE TOGGLE TEST)
  it("unregisters all registrations on cleanup", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("{type}")).toBeUndefined();
  });

  // Deactivate callback
  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

#### Toggle Test Template for Topology

```typescript
// src/extensions/__tests__/topology.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { getCommandById } from "../../core/lib/commandRegistry";

// Mock Tauri event listener (topology uses listen for file watcher)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock @tauri-apps/plugin-store (topology reads defaultTab setting)
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
    }),
  },
}));

// Mock navigation actor (topology sends SWITCH_PROCESS)
vi.mock("../../core/machines/navigation/context", () => ({
  getNavigationActor: vi.fn(() => ({
    send: vi.fn(),
  })),
}));

// Mock git-ops store
vi.mock("../../core/stores/domain/git-ops", () => ({
  useGitOpsStore: {
    getState: () => ({
      repoStatus: null,
      nodes: [],
      loadGraph: vi.fn(),
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

import { onActivate, onDeactivate } from "../topology";

describe("topology extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("topology");
  });

  it("registers topology-graph blade type on activation", async () => {
    await onActivate(api);
    expect(getBladeRegistration("topology-graph")).toBeDefined();
    api.cleanup();
  });

  it("registers blade without ext: namespace (coreOverride)", async () => {
    await onActivate(api);
    expect(getBladeRegistration("ext:topology:topology-graph")).toBeUndefined();
    api.cleanup();
  });

  it("blade is singleton and lazy", async () => {
    await onActivate(api);
    const reg = getBladeRegistration("topology-graph");
    expect(reg?.singleton).toBe(true);
    expect(reg?.lazy).toBe(true);
    api.cleanup();
  });

  it("tracks source as ext:topology", async () => {
    await onActivate(api);
    const reg = getBladeRegistration("topology-graph");
    expect(reg?.source).toBe("ext:topology");
    api.cleanup();
  });

  it("registers show-topology command", async () => {
    await onActivate(api);
    expect(getCommandById("ext:topology:show-topology")).toBeDefined();
    api.cleanup();
  });

  // THE TOGGLE TEST: full enable/disable/re-enable cycle
  it("cleanup removes all registrations (disable)", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("topology-graph")).toBeUndefined();
    expect(getCommandById("ext:topology:show-topology")).toBeUndefined();
  });

  it("re-activation after cleanup restores registrations (re-enable)", async () => {
    await onActivate(api);
    api.cleanup();

    // Create fresh API for re-activation
    const api2 = new ExtensionAPI("topology");
    await onActivate(api2);
    expect(getBladeRegistration("topology-graph")).toBeDefined();
    expect(getCommandById("ext:topology:show-topology")).toBeDefined();
    api2.cleanup();
  });

  it("onDeactivate is a no-op", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

#### Toggle Test Template for Init-Repo

```typescript
// src/extensions/__tests__/init-repo.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { getCommandById } from "../../core/lib/commandRegistry";

// Mock blade opener
vi.mock("../../core/lib/bladeOpener", () => ({
  openBlade: vi.fn(),
}));

import { onActivate, onDeactivate } from "../init-repo";

describe("init-repo extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("init-repo");
  });

  it("registers init-repo blade on activation", async () => {
    await onActivate(api);
    expect(getBladeRegistration("init-repo")).toBeDefined();
    api.cleanup();
  });

  it("registers blade without ext: namespace (coreOverride)", async () => {
    await onActivate(api);
    expect(getBladeRegistration("ext:init-repo:init-repo")).toBeUndefined();
    api.cleanup();
  });

  it("blade is singleton and lazy", async () => {
    await onActivate(api);
    const reg = getBladeRegistration("init-repo");
    expect(reg?.singleton).toBe(true);
    expect(reg?.lazy).toBe(true);
    api.cleanup();
  });

  it("registers init-repository command", async () => {
    await onActivate(api);
    expect(getCommandById("ext:init-repo:init-repository")).toBeDefined();
    api.cleanup();
  });

  it("cleanup removes all registrations (disable)", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("init-repo")).toBeUndefined();
    expect(getCommandById("ext:init-repo:init-repository")).toBeUndefined();
  });

  it("re-activation after cleanup works (re-enable)", async () => {
    await onActivate(api);
    api.cleanup();

    const api2 = new ExtensionAPI("init-repo");
    await onActivate(api2);
    expect(getBladeRegistration("init-repo")).toBeDefined();
    api2.cleanup();
  });

  it("onDeactivate is a no-op", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

#### Toggle Test Template for Worktrees

```typescript
// src/extensions/__tests__/worktrees.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { useSidebarPanelRegistry } from "../../core/lib/sidebarPanelRegistry";
import { getCommandById } from "../../core/lib/commandRegistry";

// Mock git-ops store
vi.mock("../../core/stores/domain/git-ops", () => ({
  useGitOpsStore: {
    getState: () => ({
      repoStatus: null,
      worktreeList: [],
      loadWorktrees: vi.fn(),
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

import { onActivate, onDeactivate } from "../worktrees";

describe("worktrees extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("worktrees");
  });

  it("registers worktree-panel sidebar on activation", async () => {
    await onActivate(api);
    expect(useSidebarPanelRegistry.getState().panels.has("ext:worktrees:worktree-panel")).toBe(true);
    api.cleanup();
  });

  it("sidebar panel has priority 69 and defaultOpen false", async () => {
    await onActivate(api);
    const panel = useSidebarPanelRegistry.getState().panels.get("ext:worktrees:worktree-panel");
    expect(panel?.priority).toBe(69);
    expect(panel?.defaultOpen).toBe(false);
    api.cleanup();
  });

  it("registers 2 commands on activation", async () => {
    await onActivate(api);
    expect(getCommandById("ext:worktrees:create-worktree")).toBeDefined();
    expect(getCommandById("ext:worktrees:refresh-worktrees")).toBeDefined();
    api.cleanup();
  });

  it("cleanup removes all registrations (disable)", async () => {
    await onActivate(api);
    api.cleanup();
    expect(useSidebarPanelRegistry.getState().panels.has("ext:worktrees:worktree-panel")).toBe(false);
    expect(getCommandById("ext:worktrees:create-worktree")).toBeUndefined();
    expect(getCommandById("ext:worktrees:refresh-worktrees")).toBeUndefined();
  });

  it("re-activation after cleanup works (re-enable)", async () => {
    await onActivate(api);
    api.cleanup();

    const api2 = new ExtensionAPI("worktrees");
    await onActivate(api2);
    expect(useSidebarPanelRegistry.getState().panels.has("ext:worktrees:worktree-panel")).toBe(true);
    api2.cleanup();
  });

  it("onDeactivate is a no-op", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

#### Key Test Patterns

1. **Toggle = activate + cleanup + verify empty + re-activate + verify present + cleanup**
2. `api.cleanup()` must be called in each test to avoid cross-contamination (or use `afterEach`)
3. For extensions using `coreOverride: true`, verify both that the core type is registered AND that the `ext:` prefixed version is NOT
4. For sidebar panels, use `useSidebarPanelRegistry.getState().panels.has(...)` instead of blade registry
5. For commands, use `getCommandById(...)` from `commandRegistry`
6. Mocking pattern: mock Tauri APIs and store dependencies before importing the extension module

---

### Store Reset & Subscription Edge Cases

**Confidence: HIGH** (verified by reading store implementations)

#### Extension Stores and Their Reset Patterns

| Extension | Store | Has `reset()` | Cleanup via `onDispose` |
|-----------|-------|---------------|------------------------|
| conventional-commits | `useConventionalStore` | Yes | Yes (`api.onDispose(() => useConventionalStore.getState().reset())`) |
| conventional-commits | `useChangelogStore` | Yes | No (not explicitly reset on dispose) |
| init-repo | `useInitRepoStore` | Yes | Yes (async: `import("./store").then(m => m.useInitRepoStore.getState().reset())`) |
| topology | N/A (uses `useGitOpsStore` topology slice) | Yes (`resetTopology`) | No (TOPO-08 decision: topology data stays in GitOpsStore) |
| worktrees | N/A (uses `useGitOpsStore` worktree slice) | Yes (has slice-level methods) | No (data is core, not extension-owned) |

#### `createBladeStore` Auto-Registration

Both `useConventionalStore` and `useInitRepoStore` use `createBladeStore()` which calls `registerStoreForReset(store)`. This means they are registered in the global `storeResetFns` set and will be reset when `resetAllStores()` is called.

**Edge case:** If an extension creates a `createBladeStore` and then gets disabled, the store's reset function remains in `storeResetFns`. This is harmless (reset to initial state is idempotent) but means the store reference persists in memory. This is acceptable for built-in extensions that are bundled code.

#### Zustand Auto-Reset Mock in Tests

The test setup file (`src/core/test-utils/setup.ts`) includes `vi.mock("zustand")` which activates the `__mocks__/zustand.ts` auto-reset mock. This means Zustand stores are automatically reset between tests. The `createBladeStore` auto-reset via `registerStoreForReset` is separate from the test-level auto-reset.

#### Subscription Edge Cases

1. **Navigation subscriptions** (`onDidNavigate`): Automatically cleaned up by `ExtensionAPI.cleanup()` which calls `unsubscribe()` on each subscription. No edge case.
2. **Git hook subscriptions**: Cleaned up by both individual `unsub()` calls and `gitHookBus.removeBySource()`. Double-cleanup is safe.
3. **Machine subscriptions**: Actor is stopped and subscription is unsubscribed. If actor.stop() throws, the error is caught and cleanup continues.
4. **Event bus subscriptions**: `extensionEventBus.removeAllForSource()` removes all handlers for the extension.

**No unhandled edge cases found.** The cleanup implementation is robust with try/catch around each disposable.

---

### Tauri/Rust Considerations

**Confidence: HIGH** (verified by reading Rust source files)

#### Rust-Side Extension Discovery

File: `src-tauri/src/extensions/discovery.rs`

The Rust `discover_extensions` command scans `{repoPath}/.flowforge/extensions/` for external extension manifests. This is **unrelated to built-in extensions** which are registered entirely on the frontend via `registerBuiltIn()`.

**No Rust changes needed for Phase 47.** The discovery system handles external extensions only, and all current built-in extensions bypass Rust discovery entirely.

#### IPC Patterns

- Built-in extensions import from `../../bindings` (Tauri IPC bindings generated by specta)
- The topology extension uses `listen("repository-changed", ...)` for file watcher events -- this is a Tauri event listener, cleaned up via `api.onDispose()`
- No new Tauri commands or events are needed for cleanup

#### File Watcher Lifecycle

The topology extension registers a file watcher via `listen("repository-changed", ...)`. The unlisten function is passed to `api.onDispose()`. This means:
- When topology is disabled, the file watcher is cleaned up
- When topology is re-enabled, a new file watcher is created
- This is correct behavior -- no edge case

---

### CSS/Tailwind Cleanup

**Confidence: HIGH** (verified by searching for extension-specific styles)

#### No Extension-Specific CSS

No extensions define custom `@keyframes` or `--animate-*` variables. All styling uses Tailwind utility classes with `ctp-*` (Catppuccin) tokens.

#### CSS Patterns Used by Extensions

- All extensions use standard Tailwind v4 utilities: `bg-ctp-surface0`, `text-ctp-text`, etc.
- The topology extension uses inline SVG paths for graph rendering (no CSS)
- The worktrees extension uses `document.dispatchEvent(new CustomEvent(...))` for dialog triggers (no CSS)

**No CSS cleanup needed.** Extensions are CSS-independent.

---

### Extensibility Enforcement Patterns

**Confidence: MEDIUM** (based on codebase analysis; enforcement tooling is recommended, not yet implemented)

#### Current Module Boundaries

The project has two architectural layers:
1. **Core** (`src/core/`) -- platform infrastructure: registries, stores, navigation, blades
2. **Extensions** (`src/extensions/`) -- feature modules that register into core registries

#### Current Violations

As documented in the Cleanup Inventory section, there are 10+ import violations where:
- Core imports from extensions (core -> conventional-commits, core -> github)
- Extensions import from other extensions (topology -> conventional-commits)

These violate the intended dependency direction: `extensions -> core` (never `core -> extensions` or `extension A -> extension B`).

#### Enforcement Options

**Option 1: ESLint `no-restricted-imports` (recommended)**

The project does not currently have ESLint configured. Adding it solely for boundary enforcement is possible but heavyweight. A lighter alternative:

**Option 2: Custom Boundary Check Script**

```bash
#!/bin/bash
# scripts/check-boundaries.sh

echo "Checking module boundaries..."

# Core must not import from extensions (except types)
CORE_VIOLATIONS=$(grep -rn "from.*\.\./.*extensions/" src/core/ --include="*.ts" --include="*.tsx" \
  | grep -v "extensionTypes" | grep -v "extensionManifest" | grep -v "ExtensionHost" \
  | grep -v "extensionCategories" | grep -v "extensionReadme")

# Extensions must not import from other extensions
EXT_VIOLATIONS=$(grep -rn "from.*\.\./" src/extensions/*/components/ src/extensions/*/blades/ src/extensions/*/lib/ \
  --include="*.ts" --include="*.tsx" \
  | grep -E "from.*\.\./\.\./[a-z]" | grep -v "__tests__")

if [ -n "$CORE_VIOLATIONS" ] || [ -n "$EXT_VIOLATIONS" ]; then
  echo "BOUNDARY VIOLATIONS FOUND:"
  echo "$CORE_VIOLATIONS"
  echo "$EXT_VIOLATIONS"
  exit 1
fi

echo "No boundary violations found."
```

**Option 3: TypeScript Path Aliases with Project References**

Use `tsconfig.json` project references to create compilation boundaries:
```json
// src/core/tsconfig.json
{
  "compilerOptions": { "paths": { "@core/*": ["./*"] } },
  "references": [] // NO reference to extensions
}
```

This is the strongest enforcement but requires significant tsconfig restructuring.

**Recommendation:** Start with Option 2 (script) for Phase 47, document the violations, and plan Option 1 (ESLint) for a future phase.

#### What Makes Extension Boundaries Hard to Violate

Current positive patterns that already enforce boundaries:

1. **Namespaced registration** -- `ext:{extensionId}:{resourceId}` convention makes cross-extension references explicit
2. **`source` tracking** -- Every registration includes `source: "ext:{id}"` for cleanup
3. **API facade** -- Extensions interact with core only through `ExtensionAPI` instance
4. **Priority clamping** -- Sidebar panels (max 69) and status bar items (max 89) prevent extensions from overriding core UI
5. **Registry-based discovery** -- `rootBladeForProcess()` checks the blade registry at runtime, not static imports

---

### Recommendations for Planning

#### Task Breakdown (4 requirements)

**CLEAN-01: Empty Source Directories** (0 effort)
- Already satisfied. No empty directories exist. Include a verification step that runs `find src -type d -empty` to confirm.

**CLEAN-02: Discovery Types Split** (~30 min)
- Edit `src/core/blades/_discovery.ts`
- Split `EXPECTED_TYPES` into `CORE_TYPES` and `EXTENSION_TYPES`
- Change extension warning from `console.warn` to `console.info`
- Test: verify dev console output after the change

**CLEAN-03: Toggle Tests** (~2 hours)
- Create 3 test files:
  - `src/extensions/__tests__/topology.test.ts`
  - `src/extensions/__tests__/init-repo.test.ts`
  - `src/extensions/__tests__/worktrees.test.ts`
- Follow patterns from existing tests (see templates above)
- Key mocks needed: `@tauri-apps/api/event`, `@tauri-apps/plugin-store`, `../../bindings`, navigation context, git-ops store
- Each test needs: registration check, namespace check, cleanup (disable), re-activation (re-enable), onDeactivate no-op

**CLEAN-04: Extension Developer Documentation** (~1 hour)
- Create `src/extensions/topology/README.md` (only missing README)
- Clean up `src/extensions/init-repo/components/index.ts` (stale comment)
- Optionally: add a "Writing Your First Extension" section to the existing pattern or a top-level extensions README

#### Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Topology test needs many mocks (ReactFlow, Tauri events, store) | Medium -- test complexity | Mock at the module level (onActivate), not component level |
| Cross-extension imports may break if extracted | High -- runtime errors | Document but don't move imports in this phase |
| `createBladeStore` stores persist in memory after disable | Low -- memory leak negligible for built-in | Document as known behavior, not a bug |

#### Test Count Impact

Current: 270 passing tests (3 failing due to Monaco editor mock issue -- pre-existing)
Expected after Phase 47: ~290 tests (adding ~20 across 3 new test files)

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (current) | Test runner | Already configured with jsdom environment |
| @testing-library/react | (current) | Component testing | Used by existing topology component test |
| Zustand | (current) | State management | Auto-reset mock pattern already established |

### Supporting

No new libraries needed. All testing infrastructure exists.

## Common Pitfalls

### Pitfall 1: Topology Extension Mock Complexity
**What goes wrong:** Topology's `onActivate` calls `listen()` (Tauri events) and reads settings from `@tauri-apps/plugin-store`. If these aren't mocked, tests fail with "not a function" errors.
**Why it happens:** Tauri APIs are only available in the desktop runtime, not jsdom.
**How to avoid:** Mock at module level before importing the extension module. Use `vi.mock()` (hoisted).
**Warning signs:** `TypeError: listen is not a function` in test output.

### Pitfall 2: Init-Repo Async Store Reset
**What goes wrong:** The init-repo extension uses `import("./store").then(...)` for lazy store reset in `onDispose`. This is async and may not complete before assertions.
**Why it happens:** Dynamic import returns a promise, and `api.cleanup()` calls disposables synchronously.
**How to avoid:** In toggle tests, don't assert on store state reset -- assert on registration/unregistration only. Store reset is an implementation detail.

### Pitfall 3: Worktrees JSX in index.tsx
**What goes wrong:** The worktrees extension entry point is `index.tsx` (not `.ts`) because `renderAction` returns JSX inline. Tests importing this need React available.
**Why it happens:** `contributeSidebarPanel`'s `renderAction` returns a JSX element.
**How to avoid:** The jsdom environment already includes React. No special handling needed, but the import path must use `.tsx` awareness.

## Sources

### Primary (HIGH confidence)
- Direct filesystem inspection of all files referenced
- `src/core/blades/_discovery.ts` -- current EXPECTED_TYPES
- `src/extensions/__tests__/*.test.ts` -- 11 existing test files for pattern reference
- `src/extensions/*/index.ts` -- all extension entry points
- `src/core/lib/bladeRegistry.ts` -- registry store implementation
- `src/extensions/ExtensionAPI.ts` -- cleanup() implementation
- `src/extensions/ExtensionHost.ts` -- activation/deactivation lifecycle

### Secondary (MEDIUM confidence)
- Prior phase plans and commit history for architectural decisions
- Memory/CLAUDE.md for testing patterns and known issues

## Metadata

**Confidence breakdown:**
- Cleanup inventory: HIGH -- verified all paths exist/don't exist
- Discovery refactoring: HIGH -- read the exact file, counted all blade registrations
- Toggle tests: HIGH -- followed established patterns from 11 existing test files
- Store reset: HIGH -- read all store implementations and cleanup code
- Tauri/Rust: HIGH -- read Rust source, confirmed no changes needed
- CSS cleanup: HIGH -- searched all extension files, no custom CSS
- Extensibility enforcement: MEDIUM -- recommendations based on analysis, not implemented tooling

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable architecture, no external dependency changes expected)

---

## RESEARCH COMPLETE
