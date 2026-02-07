---
status: diagnosed
trigger: "Investigate why the FlowForge app shows duplicate blade registration warnings in the console"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED -- HMR re-executes registration modules whose dependencies changed, calling registerBlade() again against persistent registry Map
test: Traced all import chains, verified Vite transforms, confirmed HMR injection patterns
expecting: N/A -- root cause found
next_action: Report diagnosis

## Symptoms

expected: No duplicate registration warnings in console
actual: 7 blades show "[BladeRegistry] Duplicate registration" warnings: diff, repo-browser, viewer-3d, viewer-code, viewer-image, viewer-markdown, viewer-nupkg
errors: "[Warning] [BladeRegistry] Duplicate registration for X (bladeRegistry.ts, line 4)"
reproduction: Start the app in dev mode, trigger HMR update on bladeUtils.tsx or BladeBreadcrumb.tsx
started: Commit d72f0a6 (feat(22-16): unified breadcrumb UX) -- when renderPathBreadcrumb was added to bladeUtils.tsx and 7 registration files were updated to use it

## Eliminated

- hypothesis: Multiple registerBlade() calls for same type in source code
  evidence: Each blade type has exactly ONE registerBlade() call, in its dedicated registration file
  timestamp: 2026-02-08

- hypothesis: Multiple import paths loading registrations/index.ts
  evidence: Only App.tsx line 5 imports registrations. No other import path exists.
  timestamp: 2026-02-08

- hypothesis: React StrictMode causing re-execution of module-level side effects
  evidence: StrictMode double-invokes React lifecycle, NOT ES module top-level code
  timestamp: 2026-02-08

- hypothesis: Barrel re-exports causing circular import chain
  evidence: blades/index.ts re-exports components, NOT registration files. No circular dependency.
  timestamp: 2026-02-08

- hypothesis: Vite optimizeDeps creating duplicate module instances
  evidence: Registration files are in src/, not node_modules. Not subject to pre-bundling.
  timestamp: 2026-02-08

## Evidence

- timestamp: 2026-02-08
  checked: src/lib/bladeRegistry.ts -- the registry and registerBlade function
  found: Module-level Map persists across HMR. registerBlade() warns if type already exists but still overwrites (registry.set).
  implication: If registerBlade() is called twice for the same type, the warning fires. The Map survives because bladeRegistry.ts itself is not re-executed during HMR (it doesn't change).

- timestamp: 2026-02-08
  checked: All 13 registration files for their import dependencies
  found: Duplicated group (7 files) ALL import from bladeUtils.tsx (renderPathBreadcrumb) or BladeBreadcrumb.tsx. Non-duplicated group (6 files) do NOT import from either.
  implication: The shared dependency (bladeUtils.tsx / BladeBreadcrumb.tsx) is the HMR propagation trigger.

- timestamp: 2026-02-08
  checked: Vite-transformed output of registration files via dev server
  found: .tsx files (diff.tsx, repo-browser.tsx) get React Fast Refresh HMR injection. .ts files get NO HMR injection. But ALL affected files share bladeUtils.tsx as a dependency.
  implication: HMR propagation path is: bladeUtils.tsx changes -> 7 registration files affected -> registrations/index.ts (glob parent) -> App.tsx (React Fast Refresh boundary). Vite re-fetches affected modules with cache-busting params.

- timestamp: 2026-02-08
  checked: registrations/index.ts glob pattern and Vite HMR docs
  found: Uses import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true }) with negative pattern. Known Vite issues (#13374, #20852) show problems with negative glob patterns and HMR. Glob parents cause full re-evaluation of all glob-matched modules during HMR.
  implication: When the glob parent (index.ts) is invalidated via HMR, ALL 13 registration modules in the glob may be re-fetched. But only the 7 whose dependency graph was modified will have changed -- however Vite may re-fetch all of them due to glob re-evaluation.

- timestamp: 2026-02-08
  checked: git log for registrations directory
  found: Commit d72f0a6 modified exactly the 7 duplicated registration files to switch from renderPathTitle to renderPathBreadcrumb, and added BladeBreadcrumb import to bladeUtils.tsx
  implication: The breadcrumb refactoring created a new shared dependency (BladeBreadcrumb.tsx) in the import graph of these 7 files. Any edit to BladeBreadcrumb.tsx now triggers HMR re-evaluation of all 7.

## Resolution

root_cause: During Vite HMR in development, when shared dependencies of registration files (bladeUtils.tsx, BladeBreadcrumb.tsx) are modified, Vite re-evaluates the affected registration modules. Their top-level registerBlade() calls execute again against the persistent registry Map in bladeRegistry.ts (which was NOT re-executed and still holds the old entries), triggering the "Duplicate registration" warning for all 7 affected blade types. The 6 unaffected blade types don't share these dependencies, so their modules are not re-evaluated during HMR.
fix:
verification:
files_changed: []
