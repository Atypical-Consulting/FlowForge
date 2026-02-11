# Phase 47: Cleanup & Verification - Architecture Research

**Researched:** 2026-02-11
**Domain:** Extension system cleanup, dead code removal, test infrastructure
**Confidence:** HIGH (all findings derived from direct codebase analysis)

## Summary

Phase 47 is a cleanup and verification phase following the completion of three extension extractions (worktrees, init-repo, topology) in phases 44-46. The codebase is in reasonably good shape -- no empty directories remain, all three new extensions are properly registered, and the extension system architecture is consistent. However, there are four concrete work areas:

1. **`_discovery.ts` EXPECTED_TYPES** currently lists 9 blade types as a flat array with no CORE/EXTENSION distinction. It needs splitting to reflect the architectural boundary.
2. **Missing toggle tests** for the three newly extracted extensions (init-repo, worktrees, topology) -- all other built-in extensions have toggle tests.
3. **Cross-boundary imports** where core code imports from extension directories (ToggleSwitch, PermissionBadge from github; parseConventionalMessage, commit-type-theme from conventional-commits). These violate the core-cannot-depend-on-extensions principle.
4. **Topology extension is missing a README.md** file, breaking consistency with all other extensions.

**Primary recommendation:** Split `_discovery.ts` into CORE + EXTENSION lists, write toggle tests for the 3 new extensions following the established pattern in `src/extensions/__tests__/`, and move shared UI components (ToggleSwitch, PermissionBadge) from the github extension into `src/core/components/ui/`.

---

## Architecture Research: Phase 47 Cleanup & Verification

### Dead Code & Empty Directory Audit

**Confidence: HIGH** (direct filesystem analysis via `find -type d -empty`)

**Finding: No empty directories exist in `src/`.** The `find` command returned zero results.

**Old extraction locations analysis:**

| Pre-extraction Location | Current Status | Clean? |
|------------------------|----------------|--------|
| `src/core/blades/topology-graph/` | Never existed as a directory (was a blade type, not a directory) | N/A |
| `src/core/blades/init-repo/` | Never existed (init-repo was not a core blade) | N/A |
| `src/core/blades/worktree*/` | Never existed (worktrees was a sidebar panel, not a blade) | N/A |
| `src/core/blades/commit-list-fallback/` | **Still exists and is used** -- this is the fallback blade for when the topology extension is disabled | Keep |

**Key insight:** The commit-list-fallback blade in `src/core/blades/commit-list-fallback/` is **intentionally retained** as the degraded-experience fallback when the topology extension is disabled. This is referenced by `rootBladeForProcess()` in `src/core/machines/navigation/actions.ts` (line 22-28). It should NOT be removed.

**Stale import check:**
- Zero imports from `src/core/blades/topology*` -- clean
- Zero imports from `src/core/blades/init-repo*` -- clean
- Zero imports from `src/core/blades/worktree*` -- clean

**CLEAN-01 Assessment:** No cleanup needed for empty directories. No remnant files found at old locations. This requirement is already satisfied.

---

### Discovery Types Analysis

**Confidence: HIGH** (source file: `src/core/blades/_discovery.ts`)

**Current state of `_discovery.ts`:**

```typescript
const EXPECTED_TYPES: string[] = [
  "staging-changes", "commit-list-fallback", "commit-details", "diff",
  "branch-manager", "repo-browser", "settings",
  "extension-manager", "extension-detail",
];
```

This is a **flat array of 9 blade types** used only in dev-mode as an exhaustiveness check. It verifies that all expected core blade registrations (`src/core/blades/*/registration.{ts,tsx}`) have fired.

**What the CORE vs EXTENSION split should look like:**

The 9 types listed are genuinely **core blades** -- they all live in `src/core/blades/` and register via `import.meta.glob("./*/registration.{ts,tsx}")`. Extension blades (topology-graph, init-repo, viewer-*, etc.) are NOT in this list and SHOULD NOT be added -- they register through the ExtensionHost, not through _discovery.ts.

**Proposed split:**

```typescript
/** Blades that are part of the core platform and always available */
const CORE_TYPES: string[] = [
  "staging-changes", "commit-list-fallback", "commit-details", "diff",
  "branch-manager", "repo-browser", "settings",
  "extension-manager", "extension-detail",
];

/** Blades contributed by built-in extensions (registered via ExtensionHost) */
const EXTENSION_TYPES: string[] = [
  "topology-graph",
  "init-repo",
  "conventional-commit", "changelog",
  "gitflow-cheatsheet",
  "viewer-code", "viewer-markdown", "viewer-3d",
  "viewer-image", "viewer-nupkg", "viewer-plaintext",
  "welcome-screen",
];
```

**Type dependency analysis from `BladePropsMap` (`src/core/stores/bladeTypes.ts`):**

The `BladePropsMap` interface defines all blade types and their props. Currently it contains 16 entries mixing core and extension types. After the split:

- **Core types (always available):** staging-changes, commit-list-fallback, commit-details, diff, branch-manager, repo-browser, settings, extension-manager, extension-detail
- **Extension types (available when extension active):** topology-graph, init-repo, conventional-commit, changelog, gitflow-cheatsheet, viewer-code, viewer-markdown, viewer-3d, viewer-image, viewer-nupkg, viewer-plaintext, welcome-screen

**Note on `BladePropsMap`:** The extension blade types in `BladePropsMap` use `coreOverride: true` which means they register under their original type string (not namespaced). This is fine for type safety at compile time, but the runtime discovery check in `_discovery.ts` should differentiate core vs extension.

**The `_discovery.ts` mechanism only checks CORE blades** (those loaded via `import.meta.glob("./*/registration.{ts,tsx}")`). Extension blades are registered dynamically by `ExtensionHost.registerBuiltIn()` and don't go through this glob pattern. So the EXTENSION_TYPES list would be used for a **separate** dev-mode check (e.g., verifying all expected built-in extensions registered their blades after `activateAll()`).

---

### Extension Registration Architecture

**Confidence: HIGH** (source files: `ExtensionHost.ts`, `ExtensionAPI.ts`, `App.tsx`)

**`registerBuiltIn()` lifecycle:**

1. **Config stored:** `builtInConfigs.set(id, config)` -- persists the activate/deactivate callbacks for re-activation after deactivation
2. **Synthetic manifest created:** A manifest object with `main: "(built-in)"` and `trustLevel: "built-in"`
3. **Registered as "discovered":** Added to the extensions Map with status `"discovered"` and `builtIn: true`
4. **Immediately activated:** Creates `new ExtensionAPI(id)`, calls `config.activate(api)`, transitions to `"active"` on success
5. **References stored:** Both `extensionApis` and `extensionModules` Maps get populated for cleanup

**Deactivation flow:**
1. Calls `module.onDeactivate()` (the stored deactivate callback)
2. Calls `api.cleanup()` which removes all registrations from all registries (blades, commands, toolbar, context menu, sidebar, status bar, machines, event bus, navigation subs, git hooks, disposables)
3. Deletes from `extensionApis` and `extensionModules`
4. Sets status to `"disabled"` and persists to store

**Re-activation flow (after deactivation):**
1. `activateExtension(id)` detects `builtInConfigs.has(id)` and `ext.builtIn === true`
2. Creates a fresh `ExtensionAPI(id)` and calls the stored `activate` callback
3. All registrations are recreated from scratch
4. Status transitions back to `"active"`

**Integration points that need testing:**

| Integration Point | What to Test |
|-------------------|-------------|
| `registerBuiltIn()` | Extension appears in ExtensionHost store with correct metadata |
| `activateExtension()` | Blade/command/sidebar registrations appear in respective registries |
| `deactivateExtension()` | All registrations removed from registries |
| `activateExtension()` (re-activate) | Registrations restored after deactivation cycle |
| Core graceful degradation | When extension is disabled, core features using extension blades fall back correctly (e.g., topology-graph -> commit-list-fallback) |

**App.tsx registration site** (lines 148-252):
All 13 built-in extensions are registered in a single `useEffect` in `App.tsx`. Each call is `registerBuiltIn({id, name, version, activate, deactivate})`. The imports are static at the top of App.tsx (lines 30-42).

---

### Import Graph Health

**Confidence: HIGH** (grep analysis of all cross-boundary imports)

**Critical finding: Core imports from Extensions (dependency direction violation)**

The following imports go from `src/core/` into `src/extensions/`, violating the architectural principle that core should not depend on extensions:

| Core File | Extension Import | Severity |
|-----------|-----------------|----------|
| `core/blades/extension-manager/components/ExtensionCard.tsx` | `extensions/github/components/ToggleSwitch` | HIGH |
| `core/blades/extension-manager/components/ExtensionCard.tsx` | `extensions/github/components/PermissionBadge` | HIGH |
| `core/blades/extension-manager/components/InstallExtensionDialog.tsx` | `extensions/github/components/PermissionBadge` | HIGH |
| `core/blades/extension-detail/ExtensionDetailBlade.tsx` | `extensions/github/components/ToggleSwitch` | HIGH |
| `core/blades/extension-detail/ExtensionDetailBlade.tsx` | `extensions/extensionReadme` | LOW (this is extension infra, not a specific extension) |
| `core/blades/extension-detail/ExtensionDetailBlade.tsx` | `extensions/extensionTypes` | LOW (types only) |
| `core/blades/extension-detail/ExtensionDetailBlade.tsx` | `extensions/ExtensionHost` | LOW (extension infra) |
| `core/blades/extension-manager/ExtensionManagerBlade.tsx` | `extensions/ExtensionHost` | LOW (extension infra) |
| `core/lib/commitClassifier.ts` | `extensions/conventional-commits/lib/conventional-utils` | MEDIUM |
| `core/components/icons/CommitTypeIcon.tsx` | `extensions/conventional-commits/lib/commit-type-theme` | MEDIUM |
| `core/components/commit/CommitForm.tsx` | `extensions/conventional-commits/hooks/useAmendPrefill` | MEDIUM |
| `core/components/commit/CommitForm.tsx` | `extensions/conventional-commits/components/ConventionalCommitForm` | MEDIUM |

**HIGH severity items (ToggleSwitch, PermissionBadge):** These are generic UI components that happen to live in the GitHub extension. They should be moved to `src/core/components/ui/` since they're used by core code (extension manager and extension detail blades).

**MEDIUM severity items (conventional-commits utilities):** `commitClassifier.ts`, `CommitTypeIcon.tsx`, and `CommitForm.tsx` in core all import from the conventional-commits extension. This creates a hard dependency -- if the conventional-commits extension is disabled, these core features may break. The `parseConventionalType()` function in `commitClassifier.ts` was specifically extracted in Phase 46 and wraps the conventional-commits utility. These should use optional/lazy loading patterns or the utilities should be moved to core.

**Extension-to-extension imports:**
- `extensions/topology/components/CommitBadge.tsx` imports from `extensions/conventional-commits/lib/commit-type-theme` -- This is an inter-extension dependency. If conventional-commits is disabled, topology's CommitBadge would break.

**No circular imports detected.** All import directions flow downward:
- `App.tsx` -> `core/`, `extensions/`
- `core/` -> `core/` (valid), `extensions/` (violations noted above)
- `extensions/` -> `core/` (valid, extensions depend on core APIs)
- `extensions/` -> `extensions/` (conventional-commits<-topology, noted above)

**Stale re-exports:** The `src/extensions/index.ts` barrel only re-exports from `ExtensionHost.ts`, `ExtensionAPI.ts`, `extensionManifest.ts`, and `extensionTypes.ts`. This is clean and appropriate.

---

### Test Infrastructure Assessment

**Confidence: HIGH** (direct analysis of all test files and vitest config)

**Current test state:** 270 tests passing across 42 suites (3 suites failing due to pre-existing Monaco Editor `queryCommandSupported` issue in jsdom).

**Extension test patterns -- two distinct categories:**

**1. Extension toggle tests (`src/extensions/__tests__/*.test.ts`):**
These test the `onActivate`/`onDeactivate` lifecycle:
- Create an `ExtensionAPI` instance
- Call `onActivate(api)`
- Assert registrations appear in registries (bladeRegistry, commandRegistry, toolbarRegistry, sidebarPanelRegistry, etc.)
- Call `api.cleanup()`
- Assert all registrations removed
- Assert `onDeactivate()` doesn't throw

**Existing toggle tests (11 extensions):**

| Extension | Test File | Status |
|-----------|-----------|--------|
| conventional-commits | `__tests__/conventional-commits.test.ts` | EXISTS |
| gitflow | `__tests__/gitflow.test.ts` | EXISTS |
| github | `__tests__/github.test.ts` | EXISTS |
| viewer-3d | `__tests__/viewer-3d.test.ts` | EXISTS |
| viewer-code | `__tests__/viewer-code.test.ts` | EXISTS |
| viewer-markdown | `__tests__/viewer-markdown.test.ts` | EXISTS |
| viewer-image | `__tests__/viewer-image.test.ts` | EXISTS |
| viewer-nupkg | `__tests__/viewer-nupkg.test.ts` | EXISTS |
| viewer-plaintext | `__tests__/viewer-plaintext.test.ts` | EXISTS |
| **init-repo** | **MISSING** | NEEDS CREATION |
| **worktrees** | **MISSING** | NEEDS CREATION |
| **topology** | **MISSING** | NEEDS CREATION |
| welcome-screen | **MISSING** | Not in CLEAN-03 scope but noted |

**2. Component tests (inside each extension):**
Some extensions have component-level tests (e.g., `topology/__tests__/TopologyRootBlade.test.tsx`, viewer blade tests). These are separate from toggle tests.

**Toggle test template (derived from existing patterns):**

For a blade-only extension (simplest case, like viewer-code):
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { onActivate, onDeactivate } from "../{extension-name}";

describe("{extension-name} extension", () => {
  let api: ExtensionAPI;
  beforeEach(() => { api = new ExtensionAPI("{extension-id}"); });

  it("registers {blade-type} blade type on activation", async () => {
    await onActivate(api);
    expect(getBladeRegistration("{blade-type}")).toBeDefined();
    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("{blade-type}")).toBeUndefined();
  });

  it("onDeactivate is a no-op", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

For extensions with sidebar panels (like worktrees):
```typescript
import { useSidebarPanelRegistry } from "../../core/lib/sidebarPanelRegistry";
// Also test sidebar panel registration and cleanup
```

For extensions with commands (like init-repo, topology):
```typescript
import { getCommandById } from "../../core/lib/commandRegistry";
// Also test command registration and cleanup
```

**Mocking requirements for each new extension:**

| Extension | Special Mocks Needed |
|-----------|---------------------|
| init-repo | `@tauri-apps/plugin-dialog` (open), `../../bindings` (commands.isGitRepository), `./store` (useInitRepoStore) |
| worktrees | `../../core/stores/domain/git-ops` (useGitOpsStore), possibly CustomEvent for `worktree:open-create-dialog` |
| topology | `@tauri-apps/api/event` (listen), `../../core/machines/navigation/context` (getNavigationActor), `../../core/stores/domain/git-ops` (useGitOpsStore), `@tauri-apps/plugin-store` (Store.load), `@xyflow/react` (for blade test) |

**Vitest configuration:** Standard setup with jsdom, globals enabled, setup file at `src/core/test-utils/setup.ts` that mocks Tauri APIs globally and auto-mocks Zustand.

---

### Extension API Surface Consistency

**Confidence: HIGH** (full analysis of ExtensionAPI.ts and sandbox-api-surface.ts)

**ExtensionAPI methods and their sandbox classification:**

| Method | Sandbox Safety | Used By (among 13 extensions) |
|--------|---------------|-------------------------------|
| `registerBlade(config)` | requires-trust | 11 extensions (all except worktrees, github*) |
| `registerCommand(config)` | requires-trust | 7 extensions (cc, gitflow, github, init-repo, worktrees, topology, welcome-screen*) |
| `contributeToolbar(config)` | requires-trust | 3 extensions (gitflow, github, cc*) |
| `contributeContextMenu(config)` | requires-trust | 1 extension (github) |
| `contributeSidebarPanel(config)` | requires-trust | 2 extensions (gitflow, worktrees) |
| `contributeStatusBar(config)` | requires-trust | 1 extension (github) |
| `onDidGit(op, handler)` | sandbox-safe | 0 extensions (available but unused) |
| `onWillGit(op, handler)` | sandbox-safe | 0 extensions (available but unused) |
| `onDidNavigate(handler)` | sandbox-safe | 0 extensions (available but unused) |
| `registerMachine(config)` | N/A (not classified) | 0 extensions |
| `onDispose(disposable)` | sandbox-safe | 2 extensions (init-repo, topology) |
| `events.emit/on` | sandbox-safe | 0 extensions (available but unused) |
| `settings.get/set` | sandbox-safe | 0 extensions (available but unused) |

*Note: Some extensions have indirect registrations not counted here.

**`sandbox-api-surface.ts` analysis:**

```typescript
SANDBOX_SAFE_METHODS = ["onDidGit", "onWillGit", "onDispose", "onDidNavigate", "events", "settings"];
REQUIRES_TRUST_METHODS = ["registerBlade", "registerCommand", "contributeToolbar",
                          "contributeContextMenu", "contributeSidebarPanel", "contributeStatusBar"];
```

**Missing from sandbox classification:**
- `registerMachine` -- not classified (should be requires-trust, accepts AnyStateMachine)
- `getMachineActor` -- not classified (returns actor reference)
- `onMachineTransition` -- not classified (sandbox-safe, receives serializable snapshots)
- `clearSettings` -- not classified (sandbox-safe, no DOM access)

**API surface consistency across all 13 extensions:**

All extensions follow the same pattern:
1. Export `onActivate(api: ExtensionAPI): Promise<void>`
2. Export `onDeactivate(): void`
3. Use `api.registerBlade()` with `coreOverride: true` for built-in blade types
4. Use lazy imports for blade components
5. Cleanup is handled by `api.cleanup()` in the deactivation flow

**One inconsistency:** The worktrees extension uses `index.tsx` (JSX in entry point for the `renderAction` callback). All others use `index.ts`. This is not a bug -- it's because JSX is used inline for the sidebar panel's action button. But it's a pattern consistency issue.

**Manifest.json consistency:**

| Extension | Has manifest.json | Has README.md | Has permissions | Has trustLevel |
|-----------|------------------|---------------|-----------------|----------------|
| conventional-commits | Yes | Yes | Yes (null) | Yes (built-in) |
| gitflow | Yes | Yes | No | Yes (built-in) |
| github | Yes | Yes | No | Yes (built-in) |
| init-repo | Yes | Yes | Yes (null) | Yes (built-in) |
| topology | Yes | **NO** | No | Yes (built-in) |
| viewer-3d | Yes | Yes | Yes (null) | Yes (built-in) |
| viewer-code | Yes | Yes | Yes (null) | Yes (built-in) |
| viewer-image | Yes | Yes | Yes (null) | Yes (built-in) |
| viewer-markdown | Yes | Yes | Yes (null) | Yes (built-in) |
| viewer-nupkg | Yes | Yes | Yes (null) | Yes (built-in) |
| viewer-plaintext | Yes | Yes | Yes (null) | Yes (built-in) |
| welcome-screen | Yes | Yes | Yes (null) | Yes (built-in) |
| worktrees | Yes | Yes | Yes (null) | Yes (built-in) |

**Topology is missing README.md** -- needs to be created for consistency and for the extension detail blade (which reads README.md via `getExtensionReadme()`).

---

### Recommendations for Planning

#### CLEAN-01: Empty Source Directories
**Status: Already satisfied.** No empty directories remain. No old blade/component locations exist. The `commit-list-fallback` blade in core is intentionally retained as the topology-disabled fallback and must NOT be removed.

**Action:** Verify with automated check, mark as done. Optionally add a CI lint rule that prevents empty directories.

#### CLEAN-02: Discovery Types Split
**Scope:** Modify `src/core/blades/_discovery.ts` (29 lines).

**Implementation plan:**
1. Rename `EXPECTED_TYPES` to `CORE_BLADE_TYPES`
2. Add a separate `EXTENSION_BLADE_TYPES` array
3. The existing glob `import.meta.glob("./*/registration.{ts,tsx}")` only discovers core blades, so keep the current check for `CORE_BLADE_TYPES`
4. Add a new dev-mode check that verifies extension blade types are registered after `activateAll()` completes (this would go in `App.tsx` or `ExtensionHost.ts`)

**Current 9 core blade types (verified against `src/core/blades/` directories):**
- staging-changes, commit-list-fallback, commit-details, diff
- branch-manager, repo-browser, settings
- extension-manager, extension-detail

**12 extension blade types (verified against extension entry points):**
- topology-graph, init-repo, conventional-commit, changelog
- gitflow-cheatsheet
- viewer-code, viewer-markdown, viewer-3d, viewer-image, viewer-nupkg, viewer-plaintext
- welcome-screen

**Note:** The github extension registers blades with `ext:github:` prefix (not coreOverride), so its blade types are NOT in BladePropsMap and are NOT in the extension list. Only `coreOverride: true` blades need tracking.

#### CLEAN-03: Toggle Tests for New Extensions
**Scope:** Create 3 test files in `src/extensions/__tests__/`.

**init-repo.test.ts:**
- Test: `registerBlade("init-repo")` with coreOverride
- Test: `registerCommand("ext:init-repo:init-repository")`
- Test: `onDispose` callback registered
- Test: Cleanup removes blade and command
- Mocks needed: lazy import, bladeOpener

**worktrees.test.ts:**
- Test: `contributeSidebarPanel("ext:worktrees:worktree-panel")` with priority 69
- Test: `registerCommand("ext:worktrees:create-worktree")`
- Test: `registerCommand("ext:worktrees:refresh-worktrees")`
- Test: Cleanup removes panel and commands
- Mocks needed: useGitOpsStore

**topology.test.ts:**
- Test: `registerBlade("topology-graph")` with coreOverride
- Test: `registerCommand("ext:topology:show-topology")`
- Test: File watcher listener registered via `listen()`
- Test: `onDispose` callback registered for unlisten
- Test: Cleanup removes blade, command, and listener
- Mocks needed: `@tauri-apps/api/event` (listen), navigation actor, useGitOpsStore, `@tauri-apps/plugin-store`

#### CLEAN-04: Extension Developer Documentation
**Scope:** Create or update documentation with examples from the 3 new built-in extensions.

**Topology extension is missing README.md.** Create one following the pattern of other extension READMEs (see `src/extensions/init-repo/README.md` or `src/extensions/worktrees/README.md` for the format).

#### Additional Recommendations (beyond CLEAN requirements)

**Import Direction Violations (recommended for Phase 47 or future):**

1. **Move ToggleSwitch and PermissionBadge to `src/core/components/ui/`** -- These are generic UI components imported by core code but defined in the github extension. Moving them eliminates the dependency direction violation.

2. **Conventional-commits dependency in core** -- `commitClassifier.ts` and `CommitTypeIcon.tsx` import from conventional-commits. Options:
   - Move `parseConventionalMessage` and `commit-type-theme` to `src/core/lib/` (recommended)
   - Or make the imports optional/lazy with fallbacks

3. **Add topology -> conventional-commits interop test** -- The topology extension's `CommitBadge.tsx` imports from conventional-commits. If conventional-commits is disabled, this could fail silently.

4. **Sandbox API surface gaps** -- `registerMachine`, `getMachineActor`, `onMachineTransition`, and `clearSettings` are not classified in `sandbox-api-surface.ts`. Add classifications for completeness.

5. **Worktrees entry point uses .tsx** -- Consider extracting the inline JSX in `renderAction` to a separate component file, allowing the entry point to be `.ts` for consistency.

---

## Standard Stack

### Core (no new dependencies needed)
| Library | Purpose | Already Installed |
|---------|---------|-------------------|
| Vitest | Test runner | Yes |
| @testing-library/react | Component testing | Yes |
| Zustand | State management / registry stores | Yes |

### No New Dependencies Required
Phase 47 is entirely cleanup and verification. No new libraries are needed.

## Architecture Patterns

### Recommended Project Structure (after Phase 47)

```
src/
├── core/
│   ├── blades/
│   │   ├── _discovery.ts          # CORE_BLADE_TYPES + EXTENSION_BLADE_TYPES
│   │   ├── _shared/               # Shared blade infrastructure
│   │   ├── commit-list-fallback/  # Topology-disabled fallback (KEEP)
│   │   └── {9 core blades}/      # Core platform blades
│   ├── components/
│   │   └── ui/
│   │       ├── ToggleSwitch.tsx   # MOVED from extensions/github/
│   │       └── PermissionBadge.tsx # MOVED from extensions/github/
│   └── lib/
│       ├── bladeRegistry.ts       # Zustand store for blade registrations
│       └── commandRegistry.ts     # Function-based command registry
├── extensions/
│   ├── __tests__/                 # Toggle tests for ALL built-in extensions
│   │   ├── init-repo.test.ts      # NEW
│   │   ├── worktrees.test.ts      # NEW
│   │   ├── topology.test.ts       # NEW
│   │   └── {11 existing tests}
│   ├── ExtensionAPI.ts            # Per-extension API facade
│   ├── ExtensionHost.ts           # Extension lifecycle Zustand store
│   ├── sandbox/                   # Worker-based sandbox infrastructure
│   └── {13 built-in extensions}/  # Each with index.ts, manifest.json, README.md
```

### Pattern: Extension Toggle Test

**What:** Each built-in extension must have a toggle test that verifies activate/deactivate lifecycle.
**When to use:** Required for all built-in extensions.
**Template:**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { getCommandById } from "../../core/lib/commandRegistry";
import { onActivate, onDeactivate } from "../{extension}";

describe("{extension} extension", () => {
  let api: ExtensionAPI;
  beforeEach(() => { api = new ExtensionAPI("{extension-id}"); });

  it("registers expected contributions on activation", async () => {
    await onActivate(api);
    // Assert blade/command/sidebar/toolbar registrations
    api.cleanup();
  });

  it("uses coreOverride for blade types (no ext: prefix)", async () => {
    await onActivate(api);
    expect(getBladeRegistration("{blade-type}")).toBeDefined();
    expect(getBladeRegistration("ext:{id}:{blade-type}")).toBeUndefined();
    api.cleanup();
  });

  it("cleanup removes all registrations", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("{blade-type}")).toBeUndefined();
    // Assert all registries empty for this extension
  });

  it("onDeactivate is a no-op", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

### Anti-Patterns to Avoid

- **Core importing from specific extensions:** Core code must never import from `src/extensions/{specific-extension}/`. It may import from extension infrastructure files (`ExtensionHost.ts`, `ExtensionAPI.ts`, `extensionTypes.ts`).
- **Removing commit-list-fallback:** This blade is the graceful degradation path when topology is disabled. It must remain in core.
- **Adding extension blades to _discovery.ts glob:** Extension blades register through ExtensionHost, not through the core blade discovery glob pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extension toggle test boilerplate | Custom test harness | Follow established pattern in `__tests__/viewer-code.test.ts` | Consistency across 13+ tests |
| Registry cleanup verification | Manual registry checks | `api.cleanup()` + registry state assertions | ExtensionAPI.cleanup() handles all registries atomically |

## Common Pitfalls

### Pitfall 1: Removing commit-list-fallback
**What goes wrong:** Topology extension becomes required (not optional), breaking the extension toggle contract.
**Why it happens:** It looks like dead code after topology extraction.
**How to avoid:** Check `rootBladeForProcess()` in `src/core/machines/navigation/actions.ts` -- it falls back to commit-list-fallback when topology-graph is not registered.
**Warning signs:** NavigationMachine tests fail because SWITCH_PROCESS to topology crashes.

### Pitfall 2: Not mocking @tauri-apps/api/event in topology tests
**What goes wrong:** `listen()` call in `onActivate` fails because Tauri is not available in test environment.
**Why it happens:** Topology's `onActivate` calls `listen("repository-changed", ...)` at the top level.
**How to avoid:** Mock `@tauri-apps/api/event` in the test file. The global mock in setup.ts already covers this, but verify it returns an unlisten function that's captured by `onDispose`.

### Pitfall 3: Zustand auto-mock interference with extension tests
**What goes wrong:** Zustand stores don't persist state between `onActivate()` and assertion.
**Why it happens:** The `__mocks__/zustand.ts` auto-reset mock intercepts `create()` calls.
**How to avoid:** Reset stores manually in `beforeEach` rather than relying on the auto-mock. Existing tests (e.g., `ExtensionHost.test.ts`) show the pattern: `useExtensionHost.setState({...})`.

### Pitfall 4: Testing worktrees sidebar panel with JSX
**What goes wrong:** The `renderAction` callback in worktrees' `contributeSidebarPanel` uses JSX (React.createElement), which requires the test to handle React rendering.
**Why it happens:** The worktrees entry point is `.tsx` and the `renderAction` returns a button element.
**How to avoid:** For toggle tests, only verify the panel is registered in `useSidebarPanelRegistry`. Don't try to render the action button in a unit test -- that's a component test concern.

## Code Examples

### Toggle Test: init-repo (blade + command + dispose)

```typescript
// Source: derived from existing patterns in __tests__/conventional-commits.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { getCommandById } from "../../core/lib/commandRegistry";

// Mock lazy-loaded blade component
vi.mock("../init-repo/blades/InitRepoBlade", () => ({
  InitRepoBlade: () => null,
}));
// Mock blade opener
vi.mock("../../core/lib/bladeOpener", () => ({
  openBlade: vi.fn(),
}));

import { onActivate, onDeactivate } from "../init-repo";

describe("init-repo extension", () => {
  let api: ExtensionAPI;
  beforeEach(() => { api = new ExtensionAPI("init-repo"); });

  it("registers init-repo blade type on activation", async () => {
    await onActivate(api);
    expect(getBladeRegistration("init-repo")).toBeDefined();
    api.cleanup();
  });

  it("registers blade without ext: namespace (coreOverride)", async () => {
    await onActivate(api);
    expect(getBladeRegistration("ext:init-repo:init-repo")).toBeUndefined();
    api.cleanup();
  });

  it("registers init-repository command", async () => {
    await onActivate(api);
    expect(getCommandById("ext:init-repo:init-repository")).toBeDefined();
    api.cleanup();
  });

  it("cleanup removes all registrations", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("init-repo")).toBeUndefined();
    expect(getCommandById("ext:init-repo:init-repository")).toBeUndefined();
  });

  it("onDeactivate is a no-op", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
```

### Discovery Types Split

```typescript
// Source: proposed modification to src/core/blades/_discovery.ts
const CORE_BLADE_TYPES: string[] = [
  "staging-changes", "commit-list-fallback", "commit-details", "diff",
  "branch-manager", "repo-browser", "settings",
  "extension-manager", "extension-detail",
];

const EXTENSION_BLADE_TYPES: string[] = [
  "topology-graph", "init-repo",
  "conventional-commit", "changelog", "gitflow-cheatsheet",
  "viewer-code", "viewer-markdown", "viewer-3d",
  "viewer-image", "viewer-nupkg", "viewer-plaintext",
  "welcome-screen",
];
```

## Open Questions

1. **Should conventional-commits utilities be moved to core?**
   - What we know: `parseConventionalMessage` and `commit-type-theme` are used by core code and the topology extension
   - What's unclear: Whether this is acceptable coupling or should be refactored in Phase 47
   - Recommendation: Flag for Phase 47 planning but mark as optional. Moving shared utilities to core is clean but may be out of scope for cleanup

2. **Should the welcome-screen extension get a toggle test too?**
   - What we know: CLEAN-03 specifies "all 3 new extensions" (init-repo, worktrees, topology)
   - What's unclear: welcome-screen was also recently made an extension but has no toggle test
   - Recommendation: Include it as a stretch goal if time permits, but not required by CLEAN-03

3. **How to handle the extension blade type exhaustiveness check at runtime?**
   - What we know: Core blade discovery uses import.meta.glob; extension blades register through ExtensionHost
   - What's unclear: Where to put the dev-mode check for EXTENSION_BLADE_TYPES
   - Recommendation: Add a dev-mode check in `activateAll()` that verifies expected extension blade types are registered, similar to the existing _discovery.ts pattern

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/core/blades/_discovery.ts`
- Direct codebase analysis of `src/extensions/ExtensionHost.ts`
- Direct codebase analysis of `src/extensions/ExtensionAPI.ts`
- Direct codebase analysis of `src/extensions/__tests__/*.test.ts` (all 11 existing tests)
- Direct codebase analysis of `src/extensions/*/index.ts` (all 13 extensions)
- Direct codebase analysis of `src/core/stores/bladeTypes.ts`
- Vitest test run output (270 passing, 3 failing pre-existing)
- grep/find analysis for dead code, empty directories, and import graph

## Metadata

**Confidence breakdown:**
- Dead code audit: HIGH -- exhaustive filesystem and grep analysis
- Discovery types: HIGH -- single file, clear semantics
- Extension architecture: HIGH -- full lifecycle traced through source
- Import graph: HIGH -- comprehensive grep analysis
- Test infrastructure: HIGH -- all test files read, patterns extracted
- API surface: HIGH -- full ExtensionAPI.ts and sandbox-api-surface.ts analysis

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable codebase, no external dependency changes expected)

---

## RESEARCH COMPLETE
