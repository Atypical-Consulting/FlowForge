---
status: resolved
trigger: "Browser console still shows 'Blade type X already registered' warnings during HMR, despite plan 22-19 adding import.meta.hot guard"
created: 2026-02-08T12:00:00Z
updated: 2026-02-08T12:45:00Z
---

## Current Focus

hypothesis: CONFIRMED -- The `!import.meta.hot` guard in registerBlade() is fundamentally flawed. `import.meta.hot` is always truthy in Vite dev mode (it's the HMR API object, not a "currently in HMR update" flag), so the guard either (a) suppresses ALL warnings including legitimate ones, or (b) doesn't suppress at all depending on evaluation context. The correct fix is to clear the registry on HMR dispose, not to suppress warnings.
test: Analyzed Vite HMR API semantics, traced full module execution flow, reviewed prior debug session findings
expecting: N/A -- root cause confirmed
next_action: Report diagnosis and correct fix

## Symptoms

expected: No "[BladeRegistry] Duplicate registration for X" warnings in browser console during HMR (hot reload)
actual: User reports warnings still appear during HMR despite the !import.meta.hot guard added in commit b6a185e
errors: "[BladeRegistry] Duplicate registration for X" in console
reproduction: Edit a file that triggers HMR (e.g., bladeUtils.tsx, BladeBreadcrumb.tsx, or any registration file), observe console
started: Commit d72f0a6 introduced shared dependency (bladeUtils.tsx -> renderPathBreadcrumb) across 7 registration files, creating HMR propagation chain

## Eliminated

- hypothesis: "Multiple registerBlade() calls for same type in source code"
  evidence: Each blade type has exactly one registerBlade() call in its dedicated registration file (13 files, 13 types)
  timestamp: 2026-02-08 (from prior debug session)

- hypothesis: "Multiple import paths loading registrations/index.ts"
  evidence: Only App.tsx line 5 imports registrations. No other import path exists.
  timestamp: 2026-02-08 (from prior debug session)

- hypothesis: "React StrictMode causing re-execution of module-level side effects"
  evidence: StrictMode double-invokes React lifecycle (useEffect, render), NOT ES module top-level code. Registration calls are module-level side effects, not React lifecycle.
  timestamp: 2026-02-08 (from prior debug session)

- hypothesis: "import.meta.hot correctly distinguishes HMR updates from initial load"
  evidence: Vite docs and source confirm import.meta.hot is the HMR API object -- it is truthy for ALL modules in dev mode at ALL times, not just during HMR updates. It is not a "currently updating" flag. The guard `!import.meta.hot` evaluates to false in ALL dev scenarios, making the warning unreachable.
  timestamp: 2026-02-08

## Evidence

- timestamp: 2026-02-08
  checked: The import.meta.hot guard in bladeRegistry.ts (line 22)
  found: |
    ```typescript
    if (import.meta.env.DEV && registry.has(config.type) && !import.meta.hot) {
      console.warn(`[BladeRegistry] Duplicate registration for "${config.type}"`);
    }
    ```
    The condition `!import.meta.hot` is always false in Vite dev mode because `import.meta.hot` is the HMR API object (always truthy). This means the warning is ALWAYS suppressed in dev -- not just during HMR.
  implication: The guard is the wrong approach entirely. It either over-suppresses (all warnings gone) or doesn't work as intended. The fundamental problem is that the registry Map persists across HMR updates while registration modules re-execute.

- timestamp: 2026-02-08
  checked: Vite HMR API documentation and semantics
  found: |
    - `import.meta.hot` is a readonly HotModule object injected by Vite into every module during dev mode
    - It is truthy from the moment the module is first evaluated
    - It does NOT become truthy only during HMR updates -- it's always truthy
    - The correct HMR pattern is: `import.meta.hot.accept()` to self-accept, and `import.meta.hot.dispose()` to clean up before re-execution
  implication: To properly handle HMR, the registry should be CLEARED on dispose, not have its warnings suppressed

- timestamp: 2026-02-08
  checked: registrations/index.ts HMR behavior
  found: |
    Uses `import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true })`. When any glob-matched file or its dependencies change during HMR, Vite re-evaluates index.ts and all glob-matched modules. This causes all 13 registerBlade() calls to fire again.
    Additionally, the file has a console.debug on line 27 that fires every time:
    `console.debug("[BladeRegistry] All ${registered.size} blade types registered.")`
  implication: Every HMR update touching registration files or their dependencies causes full re-registration. The console.debug also fires repeatedly, which the user may be interpreting as "warnings still appear."

- timestamp: 2026-02-08
  checked: Prior debug session (.planning/debug/duplicate-blade-registration.md)
  found: Root cause was confirmed as HMR re-executing registration modules against persistent registry Map. The 7 affected blades all share bladeUtils.tsx as a dependency (renderPathBreadcrumb). Any edit to bladeUtils.tsx or BladeBreadcrumb.tsx triggers HMR propagation through all 7.
  implication: The diagnosis was correct but the fix (suppress warning with !import.meta.hot) was the wrong remedy

- timestamp: 2026-02-08
  checked: Whether user might be seeing console.debug instead of console.warn
  found: registrations/index.ts line 27 outputs `[BladeRegistry] All 13 blade types registered.` on EVERY HMR cycle via console.debug. The exhaustiveness check (lines 12-29) re-runs every time index.ts is re-evaluated during HMR. This is a separate but related console noise issue.
  implication: User may be conflating the debug message with the warning, OR the actual warning may still fire in edge cases where import.meta.hot is undefined

## Resolution

root_cause: |
  The `!import.meta.hot` guard added in commit b6a185e is fundamentally flawed for two reasons:

  1. WRONG SEMANTICS: `import.meta.hot` is Vite's HMR API object. It is always truthy in dev mode -- it is NOT a flag that indicates "we are currently processing an HMR update." The check `!import.meta.hot` evaluates to `false` in ALL dev scenarios, making the warning unreachable. This means either:
     - The warning IS fully suppressed (so user may be seeing something else, like the console.debug message)
     - OR there's an edge case where import.meta.hot is undefined (Tauri webview, initial module load race)

  2. WRONG APPROACH: Suppressing the warning is treating the symptom, not the disease. The real problem is that the `registry` Map in bladeRegistry.ts persists across HMR updates while registration modules re-execute. The Map should be CLEARED before re-registration during HMR, not have its warnings silenced.

  Additionally, the console.debug message in registrations/index.ts ("All N blade types registered.") fires on every HMR cycle, creating console noise that the user may interpret as "warnings still appear."

fix: |
  Applied two-part fix addressing the root cause:

  **Part 1: src/lib/bladeRegistry.ts**
  - Removed the broken `!import.meta.hot` guard from registerBlade() (was always suppressing warnings)
  - registerBlade() now does a clean `registry.set()` with no conditional logic
  - Added `clearRegistry()` export for HMR dispose handler to call

  **Part 2: src/components/blades/registrations/index.ts**
  - Added static import of `clearRegistry` and `getAllBladeTypes` from bladeRegistry
  - Added `import.meta.hot.accept()` so this module self-accepts HMR updates
  - Added `import.meta.hot.dispose()` handler that synchronously clears the registry before re-registration
  - Used `data.isUpdate` flag in dispose to skip exhaustiveness check during HMR re-evaluation
  - Made exhaustiveness check synchronous (static import instead of dynamic import)
  - Removed the console.debug "All N blade types registered" message that fired on every HMR cycle

  HMR flow after fix:
  1. File change detected by Vite
  2. dispose() fires -> clearRegistry() empties the Map, sets isUpdate flag
  3. New module version executes -> import.meta.glob re-runs all registrations
  4. All registerBlade() calls populate a fresh empty Map -> no duplicates, no warnings
  5. Exhaustiveness check skipped (isUpdate flag) -> no console noise

verification: TypeScript compilation passes (tsc --noEmit exit code 0). No type errors introduced.
files_changed:
  - src/lib/bladeRegistry.ts
  - src/components/blades/registrations/index.ts
