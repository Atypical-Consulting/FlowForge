# Frontend Architecture Improvement Pitfalls

> **Research Dimension**: Pitfalls for v2 milestone (frontend architecture)
> **Project**: FlowForge -- Tauri desktop Git client
> **Codebase**: ~29,590 LOC, 21 Zustand stores, 13 blade types, 0 tests, all relative imports
> **Last Updated**: 2026-02-08

---

## Executive Summary

This document catalogs pitfalls specific to the planned architectural changes: adding XState for navigation FSM, reorganizing to blade-centric file structure, consolidating Zustand stores, fetching external APIs in Tauri, and adding test infrastructure to an untested codebase. These are integration pitfalls -- mistakes made when adding new patterns to a working system, not greenfield architecture errors.

The most dangerous pitfall is the "big bang" restructuring temptation: trying to reorganize files, consolidate stores, and add XState simultaneously. Each of these changes touches nearly every file in the project. Done together, they create merge conflicts with themselves and make rollback impossible.

---

## Critical Pitfalls

### 1. Big Bang Restructuring

**What goes wrong:** Attempting file restructuring, store consolidation, and XState introduction in a single phase (or worse, a single PR). Each change touches 50-100+ files. Combined, they create an unreviewable diff that is impossible to debug when something breaks.

**Why it happens:** The changes feel related ("we're improving architecture") and developers want to "rip the band-aid off." The codebase currently has 172 `../../` relative imports across 96 files -- touching them all at once feels efficient.

**Consequences:**
- Merge conflicts between concurrent changes
- Cannot isolate which change caused a regression
- Cannot roll back one change without losing all others
- Git blame becomes useless for weeks
- HMR breaks repeatedly during development

**Prevention:**
- **Phase these strictly**: (1) Switch to `@/` path aliases first, (2) Move files second, (3) Consolidate stores third, (4) Add XState last
- Each step should be a separate, independently deployable commit
- Path alias migration is entirely mechanical and safe -- do it first as a "no behavior change" PR
- File moves with working `@/` aliases are also mechanical -- only index files need logic changes

**Detection:** If a single PR touches more than 30 files AND changes behavior, it is too large. Split it.

**Phase**: Must be addressed before ANY restructuring begins

---

### 2. XState Absorbing Zustand Responsibilities

**What goes wrong:** When introducing XState for navigation, developers gradually move all state into the XState machine context. Navigation FSM starts managing repo state, staging state, toast state, and settings -- becoming a god machine.

**Why it happens:** XState's `context` can hold arbitrary data, and the `invoke` pattern makes it tempting to orchestrate everything through the machine. The existing cross-store coordination in `gitflow.ts` (which calls `useBranchStore.getState().loadBranches()` and `useRepositoryStore.getState().refreshStatus()` across 7 different actions) suggests the need for a central coordinator -- but making XState that coordinator conflates navigation with data management.

**Consequences:**
- XState machine becomes untestable (too many concerns)
- Re-renders cascade: any context change re-renders all subscribers
- Zustand stores become orphaned wrappers around XState context
- Two sources of truth for the same data
- Debugging requires understanding the entire machine to trace any issue

**Prevention:**
- **Hard rule: XState manages ONLY which view/blade is active and valid transitions between views.** It should not hold repository data, staging status, branch lists, or any domain data.
- XState context should contain at most: `currentBlade`, `bladeStack`, `activeProcess`. No domain data.
- Zustand stores remain the source of truth for domain data. XState reads from them via guards/conditions, never duplicates them.
- If an XState action needs to trigger a store update, it should call the store action (e.g., `useBladeStore.getState().pushBlade()`), not store the result in machine context.
- Document the boundary: "XState = navigation flow control. Zustand = data ownership."

**Detection:** If `context` in the XState machine has more than 5 properties, scope is creeping. If any Zustand store field is duplicated in XState context, there is a violation.

**Phase**: Must be established before XState machine design begins

---

### 3. Circular Dependencies During Store Consolidation

**What goes wrong:** Merging stores creates circular import dependencies. Currently, `gitflow.ts` imports from `branches.ts` and `repository.ts` at the module level. If these are consolidated into a single store or slices file, the import graph becomes circular.

**Why it happens:** The current codebase has 6 stores that call `getState()` on other stores: `gitflow` calls `branches` and `repository`, `worktrees` dynamically imports `repository`, `commands/repository.ts` calls `branches`, `stash`, and `tags`. Consolidating any pair of these creates a cycle.

**Current cross-store dependencies (from codebase analysis):**
```
gitflow.ts -> branches.ts (loadBranches, 7 call sites)
gitflow.ts -> repository.ts (refreshStatus, 7 call sites)
worktrees.ts -> repository.ts (openRepository, dynamic import)
commands/repository.ts -> branches.ts, stash.ts, tags.ts
commands/sync.ts -> repository.ts
App.tsx -> topology.ts (getState)
hooks/useKeyboardShortcuts.ts -> commandPalette.ts, blades.ts, topology.ts
```

**Consequences:**
- Runtime errors ("Cannot access 'X' before initialization")
- Vite HMR stops working for affected modules
- Subtle ordering bugs where store A initializes before store B is ready
- TypeScript type inference breaks with circular references

**Prevention:**
- Map the full dependency graph BEFORE consolidating (the graph above is a start)
- Use the Zustand "slices pattern" but keep slice creators in separate files that do NOT import each other
- Cross-slice communication should use `getState()` at call time (not import time), which is already the pattern in `gitflow.ts`
- The `worktrees.ts` dynamic import pattern (`await import("./repository")`) is the correct escape hatch for unavoidable cycles
- Consider an "actions" layer that imports multiple stores and coordinates them, rather than stores importing each other
- Run `madge --circular src/` after each consolidation step to verify no cycles were introduced

**Detection:** Vite dev server shows "circular dependency" warnings. TypeScript shows `any` types where there should be concrete types. Tests fail with initialization errors.

**Phase**: Must be addressed during store consolidation design, before implementation

---

### 4. Breaking the Blade Registration System During Restructuring

**What goes wrong:** The current blade registration system uses `import.meta.glob` to auto-discover registration files in `src/components/blades/registrations/`. Moving files to a blade-centric structure (e.g., `src/features/staging/`) breaks this glob pattern, and the dev-mode exhaustiveness check silently fails because it only warns -- it does not throw.

**Why it happens:** The glob `import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true })` is path-relative. Moving registration files to feature directories means the glob finds nothing. The HMR dispose/re-registration logic also depends on the current file structure.

**Consequences:**
- All blades stop rendering (BladeRenderer gets `undefined` from registry)
- Error is silent in production build (dev-mode check only warns)
- HMR reloads stop working for blades
- No clear error message points to the registration system

**Prevention:**
- Before moving files, refactor `import.meta.glob` to use an explicit array or a broader glob pattern like `../../features/**/registration.ts`
- Alternatively, keep a central `registrations/index.ts` that explicitly imports from feature directories (more explicit, less magic)
- Add a runtime assertion (not just dev warning) that the registry has the expected number of entries after initialization
- Test the registration system in isolation before restructuring
- The existing dev-mode exhaustiveness check should be promoted to a hard error during development:
  ```typescript
  if (missing.length > 0) {
    throw new Error(`Missing blade registrations: ${missing.join(", ")}`);
  }
  ```

**Detection:** If opening any blade shows a blank panel or "Unknown blade type" error, registration is broken. Add an integration test that verifies all 13 blade types are registered.

**Phase**: Must be addressed before file restructuring begins

---

### 5. Barrel File Performance Degradation

**What goes wrong:** When reorganizing to blade-centric modules, each feature directory gets an `index.ts` barrel file re-exporting its components, hooks, and store slices. With 13+ feature modules, Vite's dev server must parse every file in every barrel on any import, causing HMR times to spike from <100ms to 5-10+ seconds.

**Why it happens:** The codebase currently has 14 barrel files (`index.ts` files) that are relatively small. Moving to feature-based modules where each feature barrel re-exports 5-10 files creates deep import chains. Vite (used in this project via `@tailwindcss/vite` and `@vitejs/plugin-react`) does not tree-shake in dev mode, meaning every barrel import pulls in every export.

**Consequences:**
- Dev server startup goes from ~2s to ~8s
- HMR updates take 3-10 seconds instead of <100ms
- Developer productivity drops significantly
- Memory usage increases in dev mode
- The `@` path alias makes barrel files tempting ("just import from `@/features/staging`")

**Prevention:**
- **Do not create barrel files for feature modules.** Import directly from specific files: `import { StagingPanel } from "@/features/staging/StagingPanel"` not `import { StagingPanel } from "@/features/staging"`
- The existing barrel files in `src/components/blades/index.ts` (which exports 17 items) should be split or eliminated during restructuring
- Keep barrel files ONLY for genuinely shared/public APIs (e.g., `src/ui/index.ts` for shared UI primitives)
- Configure `vite-plugin-inspect` to monitor module graph size during development
- If barrel files are needed for DX, keep them thin: max 5 re-exports per barrel

**Detection:** Monitor HMR times. If any single change takes >500ms to reflect, investigate the module graph. Use `vite --debug hmr` to identify slow modules.

**Phase**: Must be addressed during file structure design, before implementation

---

## High Priority Pitfalls

### 6. Testing Zustand Stores Without Proper Isolation

**What goes wrong:** Tests share Zustand store state between test cases. One test modifies `useRepositoryStore` state, and the next test starts with that modified state, causing cascading failures.

**Why it happens:** Zustand stores are module-level singletons. Without explicit reset between tests, state persists across test cases. The official Zustand testing guide recommends creating a mock that auto-resets stores, but the setup is non-obvious and differs between Jest and Vitest.

**The FlowForge-specific complication:** Several stores have async initialization (`initTheme`, `initSettings`, `initNavigation`, `initMetadata`, `initChecklist`) that reads from Tauri's `@tauri-apps/plugin-store`. In tests, this plugin is unavailable, causing unhandled promise rejections that mask real failures.

**Consequences:**
- Tests pass individually but fail when run together
- Flaky CI (test order varies)
- Developers stop trusting tests
- Hard-to-diagnose failures where test B fails because test A left state

**Prevention:**
- Create `src/__mocks__/zustand.ts` that wraps `create` with auto-reset on `afterEach`:
  ```typescript
  // src/__mocks__/zustand.ts
  import { vi } from 'vitest';
  const { create: actualCreate } = await vi.importActual<typeof import('zustand')>('zustand');

  const storeResetFns = new Set<() => void>();

  export const create = (createState) => {
    const store = actualCreate(createState);
    const initialState = store.getState();
    storeResetFns.add(() => store.setState(initialState, true));
    return store;
  };

  afterEach(() => storeResetFns.forEach((fn) => fn()));
  ```
- Mock `@tauri-apps/plugin-store` globally in `vitest.setup.ts` to return no-op implementations
- Mock `../bindings` (the auto-generated Tauri commands) with typed mocks that return `{ status: "ok", data: ... }`

**Detection:** If more than 2 tests fail inconsistently across runs, suspect store isolation issues. Run tests with `--sequence` flag to verify order independence.

**Phase**: Must be addressed when setting up test infrastructure

---

### 7. XState Machine Too Granular or Too Coarse

**What goes wrong (too granular):** Every UI micro-state becomes a machine state: `bladeAnimatingIn`, `bladeAnimatingOut`, `bladeContentLoading`, `bladeContentError`, `bladeContentReady`. The machine has 50+ states and transitions, making it harder to understand than the code it replaced.

**What goes wrong (too coarse):** The machine has only 3 states: `welcome`, `staging`, `topology`. It does not model blade stack depth, back navigation constraints, or process switching -- which are the actual problems the current implicit navigation has.

**Why it happens:** XState encourages thinking in states, but navigation is partially stack-based (blade stack) and partially state-based (which process is active). Modeling a stack as discrete states requires either parallel states or an unbounded number of states. Neither is natural.

**The FlowForge-specific tension:** The current blade system uses a stack (`bladeStack: TypedBlade[]`) with push/pop/replace semantics. XState's hierarchical states model trees, not stacks. The `ProcessType` distinction (`staging` | `topology`) is state-like. The blade stack is data-like. Mixing them in one machine leads to awkward compromises.

**Consequences:**
- Too granular: machine is harder to reason about than imperative code
- Too coarse: machine does not prevent invalid states (the original motivation for adopting XState)
- Developers work around the machine rather than through it
- Machine definition becomes the most complex file in the codebase

**Prevention:**
- Model ONLY the process-level navigation as XState states: `noRepo`, `welcome`, `staging`, `topology`
- Keep the blade stack as XState `context` (an array), not as discrete states
- Use XState guards to enforce stack invariants (e.g., "cannot push settings blade if already in stack" -- the current SINGLETON_TYPES logic)
- Use XState actions to execute stack operations (`pushBlade`, `popBlade`)
- Start with the absolute minimum machine (4-5 states) and add states only when you discover a real invalid-state bug
- The machine should answer: "Can I navigate from A to B right now?" not "What UI animation should play?"

**Detection:** If the machine definition exceeds 100 lines, it is probably too complex for navigation. If it has fewer than 4 states, it is probably not adding value over the current Zustand approach.

**Phase**: Must be addressed during XState machine design

---

### 8. Import Path Migration Breaks Non-Obvious Consumers

**What goes wrong:** Switching from relative imports (`../../stores/blades`) to path aliases (`@/stores/blades`) or new feature paths (`@/features/staging/store`) misses imports in non-component files: Zustand stores importing other stores, command registrations, library utilities, and the auto-generated `bindings.ts`.

**Why it happens:** Automated find-and-replace covers `.tsx` component files but misses:
- Store-to-store imports (e.g., `gitflow.ts` importing from `./branches` and `./repository`)
- Command registrations in `src/commands/*.ts` (6 files importing 5+ stores)
- Hook files in `src/hooks/*.ts` (10 hooks importing from stores and lib)
- Library utilities in `src/lib/*.ts` (23 files)
- Dynamic imports (`await import("./repository")` in `worktrees.ts`)

**Current import count by depth:**
```
../../  imports:  172 occurrences across 96 files
../../../ imports:  20 occurrences across 14 files
../     imports:   ~75 occurrences across 35 files
```

**Consequences:**
- Build succeeds but runtime breaks on dynamic imports
- TypeScript type checking passes (paths are valid strings) but Vite cannot resolve them
- Errors only manifest when the specific code path is triggered at runtime
- The `import.meta.glob` in blade registrations breaks silently

**Prevention:**
- Use TypeScript's `paths` config AND Vite's `resolve.alias` together (currently only Vite alias is set: `"@": "/src"`)
- Add `paths` to `tsconfig.json` to match:
  ```json
  "paths": { "@/*": ["./src/*"] }
  ```
- Write a migration script that handles ALL import patterns, not just component files
- Run `tsc --noEmit` after EVERY batch of file moves (not just at the end)
- Grep for `from ['"]\.\.` after migration to find any remaining relative imports
- Test dynamic imports explicitly (the `worktrees.ts` dynamic import is easily missed)

**Detection:** After migration, `grep -r 'from "\.\.' src/` should return zero results (except possibly `bindings.ts` which is auto-generated). Any remaining relative import is a migration miss.

**Phase**: Must be addressed as the first step of file restructuring

---

### 9. GitHub .gitignore API Fetch in Tauri Without HTTP Plugin

**What goes wrong:** The Init Repo blade needs to fetch `.gitignore` templates from `https://api.github.com/gitignore/templates`. Using `window.fetch()` in a Tauri WebView may be blocked by CSP, CORS, or both. The current `tauri.conf.json` has `"csp": null` (disabled) and no HTTP plugin configured.

**Why it happens:** Tauri's WebView runs in a restricted context. While `"csp": null` currently means no CSP enforcement, this could change in updates, and the proper approach is to use Tauri's HTTP plugin. The current `capabilities/default.json` has no HTTP permissions, only `core:default`, `opener:default`, `dialog:default`, `store:default`.

**The specific risk:** `"csp": null` means CSP is currently disabled, so `fetch()` WILL work in development. But:
1. Future Tauri updates may enforce a default CSP
2. Some antivirus/security software blocks HTTP from desktop apps
3. The fetch happens from the WebView's origin (`tauri://localhost`), not a normal web origin
4. GitHub's API has rate limits (60 req/hr unauthenticated) that are not obvious during development

**Consequences:**
- Feature works in development, fails in production builds
- Feature fails silently when user has no internet (no error handling)
- GitHub API rate limiting causes intermittent failures
- Security audits flag the disabled CSP

**Prevention:**
- Use `@tauri-apps/plugin-http` for the GitHub API call, not `window.fetch()`
- Add HTTP permissions to capabilities:
  ```json
  {
    "permissions": [
      "http:default",
      { "identifier": "http:allow-fetch", "allow": [{ "url": "https://api.github.com/*" }] }
    ]
  }
  ```
- Cache the template list locally (it changes rarely) -- store in `@tauri-apps/plugin-store`
- Handle offline gracefully: ship a bundled fallback list of common templates
- Add rate limit awareness: check `X-RateLimit-Remaining` header
- Consider fetching on the Rust side via `reqwest` instead of the frontend, keeping network concerns out of the WebView entirely

**Detection:** Test with CSP enabled: set `"csp": "default-src 'self'"` temporarily and verify the feature still works. Test with network disabled.

**Phase**: Must be addressed when implementing Init Repo blade

---

### 10. Consolidating Stores That Have Persistence

**What goes wrong:** Several stores persist data via `@tauri-apps/plugin-store` with specific keys. Consolidating these stores changes the initialization flow and can orphan or corrupt persisted data.

**Currently persisted stores and their keys:**
```
navigation.ts:  "nav-pinned-repos", "nav-recent-branches", "nav-last-active-branch"
settings.ts:    "git-settings" (gpg-sign, auto-stash, etc.)
theme.ts:       "theme" (light/dark/system)
branchMetadata.ts: "branch-metadata-v1"
reviewChecklist.ts: "review-checklist-v1"
```

**Why it happens:** When consolidating `navigation.ts` with the XState navigation machine, or merging `settings.ts` and `theme.ts`, the persistence keys and initialization order change. The `initNavigation()`, `initSettings()`, `initTheme()`, `initMetadata()`, `initChecklist()` functions in `App.tsx` all run in a `useEffect` -- their relative ordering matters if one depends on another.

**Consequences:**
- User's pinned repos, recent branches, and settings disappear after update
- Theme resets to default
- Review checklist state is lost
- Subtle bugs where data loads in wrong order (e.g., theme applies after first paint, causing flash)

**Prevention:**
- Create a migration utility that reads old keys and writes to new keys before any store initializes
- Keep the same `@tauri-apps/plugin-store` key names even if the store structure changes
- If keys must change, write a one-time migration in `App.tsx` that runs before store initialization:
  ```typescript
  async function migrateStoreKeys() {
    const store = await getStore();
    const oldPinned = await store.get("nav-pinned-repos");
    if (oldPinned) {
      await store.set("navigation.pinnedRepos", oldPinned);
      await store.delete("nav-pinned-repos");
    }
    // ... more migrations
    await store.save();
  }
  ```
- Test persistence migration with real persisted data files
- Version the store schema (the `branchMetadata.ts` already uses `-v1` suffix -- adopt this pattern for all persistent stores)

**Detection:** After any store consolidation, verify: (1) fresh install works, (2) upgrade from previous version preserves data, (3) `@tauri-apps/plugin-store` file on disk has expected keys.

**Phase**: Must be addressed during store consolidation

---

## Moderate Pitfalls

### 11. XState + Zustand Subscription Conflicts

**What goes wrong:** Both XState (`useActor`/`useSelector`) and Zustand (`useStore`) trigger React re-renders. When an XState transition triggers a Zustand action (or vice versa), they create cascading re-render loops.

**Why it happens:** XState state change -> React re-render -> component reads Zustand store -> Zustand selector returns new reference -> unnecessary re-render -> component sends XState event -> cycle.

**The FlowForge-specific risk:** The `App.tsx` component already subscribes to 8 different stores. Adding XState navigation would be a 9th subscription. The `Header.tsx` component has inline `getState()` calls that could conflict with XState's render cycle.

**Prevention:**
- Use `useSelector` with strict equality for both XState and Zustand (Zustand's `shallow` comparison)
- Never send XState events inside a `useEffect` that depends on Zustand state (use XState guards instead)
- Keep the XState actor reference stable (create it once, at app level)
- Avoid reading XState state and Zustand state in the same component where possible -- create a thin adapter hook:
  ```typescript
  function useNavigationState() {
    const xstateProcess = useSelector(navActor, s => s.value);
    const bladeStack = useBladeStore(s => s.bladeStack); // from Zustand
    return { process: xstateProcess, bladeStack };
  }
  ```

**Detection:** React DevTools profiler showing more than 2 re-renders per state change. Console logging in `App.tsx` `useEffect` firing more than once per user action.

**Phase**: Address during XState integration

---

### 12. Test Infrastructure Without Testing Strategy

**What goes wrong:** Setting up Vitest, writing a few tests for easy utilities, declaring "we have tests now," and never testing the hard parts (stores, blade navigation, command palette). The test count grows but coverage is meaningless.

**Why it happens:** The codebase has 0 tests. Starting with utility functions (`fuzzySearch.ts`, `branchClassifier.ts`, `fileTypeUtils.ts`) is easy and feels productive. But the real bugs live in store interactions, blade lifecycle, and async command flows -- which are harder to test.

**The FlowForge-specific challenge:** The core logic is deeply coupled to Tauri APIs (`commands` from `bindings.ts`, `@tauri-apps/plugin-store`, `@tauri-apps/api/event`). Every store calls `commands.something()`. Every persistence operation calls `getStore()`. Testing any meaningful behavior requires mocking these boundaries.

**Prevention:**
- Establish the mock boundary FIRST:
  1. Mock `src/bindings.ts` (auto-generated Tauri commands) -- this is the single biggest dependency
  2. Mock `@tauri-apps/plugin-store` (persistence layer)
  3. Mock `@tauri-apps/api/event` (file watcher events)
- Prioritize tests by bug risk, not ease:
  1. **Store consolidation tests** -- verify merged stores behave identically to originals
  2. **Blade navigation tests** -- verify stack push/pop/replace/singleton logic
  3. **XState machine tests** -- verify valid/invalid transitions (XState machines are inherently testable)
  4. **Command registration tests** -- verify `enabled()` guards work correctly
  5. Utility function tests last (they rarely break)
- Set a coverage target for STORES AND HOOKS, not overall coverage. 80% store coverage is worth more than 40% overall coverage.

**Detection:** If after 2 weeks of test work, no store or hook has tests, the strategy has failed. If all tests are for pure functions, the strategy is misaligned.

**Phase**: Address when setting up test infrastructure

---

### 13. The `@` Alias Is Configured in Vite But Not TypeScript

**What goes wrong:** The codebase has `resolve.alias: { "@": "/src" }` in `vite.config.ts` but NO `paths` entry in `tsconfig.json`. This means `@/` imports work at runtime (Vite resolves them) but TypeScript does not understand them for type checking or IDE navigation.

**Why it happens:** The alias was added to Vite config but the TypeScript config was not updated to match. Currently this causes no issues because no code uses `@/` imports (zero occurrences found in codebase). But switching to `@/` imports during restructuring without fixing `tsconfig.json` will break `tsc --noEmit` (the build command runs `tsc && vite build`).

**Consequences:**
- `tsc` reports "Cannot find module '@/stores/blades'" errors
- IDE autocomplete and go-to-definition stop working for `@/` imports
- Build fails because `npm run build` runs `tsc && vite build`
- Developers lose confidence in the migration

**Prevention:**
- Add `paths` to `tsconfig.json` BEFORE writing any `@/` imports:
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": { "@/*": ["./src/*"] }
    }
  }
  ```
- Verify with `tsc --noEmit` after adding the paths config
- This should be the literal first commit of the restructuring work

**Detection:** `npm run build` fails. IDE shows red squiggles on `@/` imports.

**Phase**: Must be the first action item before any file restructuring

---

### 14. Orphaned Code During Tech Debt Cleanup

**What goes wrong:** The project has 9 known tech debt items including orphaned code. During cleanup, removing "orphaned" code that is actually imported via dynamic imports, `import.meta.glob`, or string-based lookups breaks the app silently.

**Why it happens:** Static analysis tools (TypeScript, ESLint) cannot detect imports via:
- `import.meta.glob` (used by blade registrations)
- Dynamic `import()` (used by `worktrees.ts`)
- String-based lookups (the blade registry uses string keys)
- Event listeners (`document.dispatchEvent(new CustomEvent("toggle-amend"))` in `commands/sync.ts`)

**Specific risks in FlowForge:**
- The `CustomEvent("toggle-amend")` pattern has no static reference to its handler -- removing the handler looks safe
- Blade registration files are only imported via glob -- they appear unreferenced in static analysis
- `previewRegistrations.ts` in staging uses a registry pattern that looks like dead code

**Prevention:**
- Before removing any code flagged as "orphaned," search for ALL reference patterns:
  1. Direct imports (`import ... from`)
  2. Dynamic imports (`import("...")`)
  3. Glob imports (`import.meta.glob`)
  4. String references (registry keys, event names)
  5. CSS class references (Tailwind generates classes dynamically)
- Use `git log --follow -- <file>` to understand why the code exists
- Remove one file at a time, test between each removal
- Keep a "quarantine" branch: move suspected dead code to a separate commit so it can be restored

**Detection:** If removing a file causes no TypeScript errors but the app breaks at runtime, there was a dynamic reference.

**Phase**: Address during tech debt cleanup

---

### 15. Zustand v5 Slice Pattern Type Complexity

**What goes wrong:** Using Zustand's slice pattern for store consolidation creates TypeScript type signatures so complex that IDE performance degrades and developers cannot understand the types. The `StateCreator<CombinedState, [], [], SliceA>` generic chain becomes 4+ levels deep.

**Why it happens:** Zustand v5 (currently used: `"zustand": "^5"`) uses complex generic inference for the slice pattern. When combining 4+ slices, the combined type requires explicit annotation that is verbose and fragile. The Zustand docs acknowledge this: "The combination of slices with TypeScript requires some extra work."

**The FlowForge-specific scale:** Consolidating even 5 of the 21 stores into slices requires a combined interface with 50+ properties and 30+ methods. The type definition alone becomes longer than most stores.

**Consequences:**
- TypeScript IntelliSense becomes slow or times out
- Type errors in one slice cascade to all slices
- Developers avoid adding to consolidated stores because the types are too complex
- Refactoring becomes harder, not easier (opposite of the goal)

**Prevention:**
- Do NOT consolidate all 21 stores into one. Group by domain into 4-5 independent stores:
  ```
  navigationStore:  navigation + blades + commandPalette (UI navigation)
  repositoryStore:  repository + branches + tags + stash (repo data)
  workflowStore:    gitflow + conventional + reviewChecklist (process)
  uiStore:          theme + settings + toast + staging (preferences/UI state)
  ```
- Keep each consolidated store under 200 lines
- Use the simple merge pattern (spread in create), not the slice creator pattern:
  ```typescript
  // Simpler than the slice pattern:
  export const useNavStore = create<NavState>((set, get) => ({
    ...createBladeSlice(set, get),
    ...createNavigationSlice(set, get),
    ...createCommandPaletteSlice(set, get),
  }));
  ```
- Export the slice interfaces separately for testing
- Keep `devtools` middleware only on the combined store, not individual slices (per Zustand docs recommendation)

**Detection:** If `tsc --noEmit` takes more than 30 seconds after adding slices, the types are too complex. If IDE autocomplete takes >1 second, simplify.

**Phase**: Address during store consolidation design

---

## Minor Pitfalls

### 16. Vitest Config Conflicts with Vite Config

**What goes wrong:** Vitest shares `vite.config.ts` by default. The current config includes `@tailwindcss/vite` plugin, which processes CSS in tests unnecessarily, and `vite-plugin-svgr`, which may break in test environment without proper setup.

**Prevention:**
- Create a separate `vitest.config.ts` that extends the base config but excludes irrelevant plugins
- Set `test.environment: 'jsdom'` (or `'happy-dom'` for faster execution)
- Mock CSS modules and SVG imports in the test setup file
- Ensure `optimizeDeps.include: ["dagre-d3-es"]` does not interfere with test bundling

**Phase**: Address during test infrastructure setup

---

### 17. Command Registration Side Effects in Tests

**What goes wrong:** The `src/commands/*.ts` files execute `registerCommand()` at module import time (side effects). Importing any file that transitively imports a command file causes command registration, which may fail in tests if the command palette store or dependencies are not initialized.

**Prevention:**
- Mock the entire `src/commands/` directory in test setup
- Alternatively, gate command registration behind an explicit `initCommands()` call
- The current `import "./commands"` in `App.tsx` is a side-effect import -- ensure tests do not load `App.tsx` unless integration-testing the full app

**Phase**: Address during test infrastructure setup

---

### 18. Loss of HMR State During Blade Structure Migration

**What goes wrong:** The current blade registration system has careful HMR handling (`import.meta.hot.dispose` clears the registry, re-registration runs on accept). Changing the file structure can break this HMR flow, causing blades to "disappear" during development until a full page reload.

**Prevention:**
- Preserve the `import.meta.hot` handling in whatever replaces the glob-based auto-discovery
- Test HMR explicitly during migration: modify a blade component and verify it hot-reloads without clearing other blades
- If using explicit imports instead of glob, each registration file still needs its own HMR accept

**Phase**: Address during file restructuring

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Path alias setup | TypeScript paths not matching Vite alias (#13) | Critical | Configure tsconfig.json paths first |
| File restructuring | Barrel file performance (#5) | High | Direct imports, no feature barrels |
| File restructuring | Blade registration glob breaks (#4) | Critical | Update glob or switch to explicit imports first |
| File restructuring | Import path migration misses (#8) | High | Script + `tsc --noEmit` after each batch |
| File restructuring | HMR state loss (#18) | Moderate | Preserve `import.meta.hot` handling |
| Store consolidation | Circular dependencies (#3) | Critical | Map dependency graph first |
| Store consolidation | Persistence key changes (#10) | High | Keep old keys or write migration |
| Store consolidation | Type complexity (#15) | High | 4-5 domain groups, not one mega-store |
| XState introduction | Absorbing Zustand responsibilities (#2) | Critical | Hard boundary: XState = navigation only |
| XState introduction | Machine granularity (#7) | High | Start minimal (4-5 states), grow if needed |
| XState + Zustand | Subscription conflicts (#11) | Moderate | Adapter hooks, strict selectors |
| Test infrastructure | Store isolation (#6) | High | Auto-reset mock, Tauri API mocks |
| Test infrastructure | Missing test strategy (#12) | High | Mock boundaries first, test stores not utils |
| Test infrastructure | Vitest config conflicts (#16) | Low | Separate vitest.config.ts |
| Test infrastructure | Command side effects (#17) | Low | Mock commands module |
| GitHub API fetch | No HTTP plugin configured (#9) | High | Use @tauri-apps/plugin-http, add capabilities |
| Tech debt cleanup | Orphaned code false positives (#14) | Moderate | Check all reference patterns before removing |
| Big bang | All changes at once (#1) | Critical | Strictly sequential phases |

---

## Recommended Phase Ordering (Based on Pitfall Dependencies)

The pitfalls reveal a natural ordering that minimizes risk:

1. **Path alias fix** (Pitfall #13) -- 1 commit, zero risk, enables everything else
2. **File restructuring** (Pitfalls #4, #5, #8, #18) -- mechanical moves, no behavior change
3. **Store consolidation** (Pitfalls #3, #10, #15) -- requires tests to verify, so...
4. **Test infrastructure** (Pitfalls #6, #12, #16, #17) -- should actually come before or during step 3
5. **XState navigation** (Pitfalls #2, #7, #11) -- requires stable stores and file structure
6. **GitHub API integration** (Pitfall #9) -- independent, can be parallel with 3-5
7. **Tech debt cleanup** (Pitfall #14) -- last, when everything else is stable and tested

Steps 3 and 4 are the key tension: you want tests to verify store consolidation, but you need stores stable to write meaningful tests. Resolution: set up test infrastructure (mocks, config, patterns) first, write store tests during consolidation.

---

## Sources

- [Zustand Slices Pattern Documentation](https://zustand.docs.pmnd.rs/guides/slices-pattern)
- [Zustand Testing Guide](https://zustand.docs.pmnd.rs/guides/testing)
- [Zustand Discussion: Multiple Stores vs Slices](https://github.com/pmndrs/zustand/discussions/2496)
- [Zustand Discussion: Merging Store Slices with TypeScript](https://github.com/pmndrs/zustand/discussions/2371)
- [Vite Performance Guide - Barrel Files Warning](https://vite.dev/guide/performance)
- [Vite Issue #16100: Barrel Files Make Vite Very Slow](https://github.com/vitejs/vite/issues/16100)
- [XState v5 React Integration (@xstate/react)](https://stately.ai/docs/xstate-react)
- [XState Global State with React](https://stately.ai/blog/2024-02-12-xstate-react-global-state)
- [XState v5 Migration Guide](https://stately.ai/docs/migration)
- [Tauri v2 HTTP Headers / CSP Documentation](https://v2.tauri.app/security/http-headers/)
- [Tauri Plugin CORS Fetch](https://github.com/idootop/tauri-plugin-cors-fetch)
- [TkDodo: Working with Zustand](https://tkdodo.eu/blog/working-with-zustand)
- [Barrel File Analysis: "Burn the Barrel"](https://uglow.medium.com/burn-the-barrel-c282578f21b6)
- [Robin Wieruch: React Folder Structure](https://www.robinwieruch.de/react-folder-structure/)
- [Bulletproof React: Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- [Vitest Getting Started](https://vitest.dev/guide/)

---

## Quality Gate Verification

- [x] Pitfalls are specific to adding these features to this existing codebase (not generic advice)
- [x] Integration pitfalls covered (XState+Zustand, file moves+registrations, stores+persistence)
- [x] Prevention strategies reference actual files and patterns in the codebase
- [x] Phase-specific warnings mapped to implementation order
- [x] Codebase analysis supports all claims (import counts, store dependencies, config values verified)
- [x] Recommended ordering based on pitfall dependency analysis
