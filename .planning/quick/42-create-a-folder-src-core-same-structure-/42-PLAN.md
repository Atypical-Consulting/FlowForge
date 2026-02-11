---
phase: quick-42
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/ (new directory containing moved blades/, commands/, components/, hooks/, lib/, machines/, stores/, test-utils/, assets/)
  - src/App.tsx
  - src/main.tsx
  - src/extensions/ExtensionAPI.ts
  - src/extensions/ExtensionHost.ts
  - src/extensions/extensionSettings.ts
  - "All files inside src/core/ that import ../bindings (need ../../bindings)"
  - "All extension files that import ../../lib, ../../stores, etc. (need ../../core/lib, etc.)"
autonomous: true
must_haves:
  truths:
    - "All core system files live under src/core/ mirroring the extensions structure"
    - "src/ root only contains App.tsx, main.tsx, index.css, bindings.ts, vite-env.d.ts, extensions/, and core/"
    - "The application compiles without TypeScript errors (excluding pre-existing TS2440 in bindings.ts)"
    - "All imports resolve correctly after the move"
  artifacts:
    - path: "src/core/blades/"
      provides: "Core blade components"
    - path: "src/core/commands/"
      provides: "Core command definitions"
    - path: "src/core/components/"
      provides: "Core UI components"
    - path: "src/core/hooks/"
      provides: "Core React hooks"
    - path: "src/core/lib/"
      provides: "Core utilities and registries"
    - path: "src/core/machines/"
      provides: "XState machines"
    - path: "src/core/stores/"
      provides: "Zustand stores"
    - path: "src/core/test-utils/"
      provides: "Test utilities"
    - path: "src/core/assets/"
      provides: "Static assets"
  key_links:
    - from: "src/App.tsx"
      to: "src/core/*"
      via: "relative imports with ./core/ prefix"
      pattern: "from [\"']\\./core/"
    - from: "src/extensions/*"
      to: "src/core/*"
      via: "relative imports with ../core/ or ../../core/ prefix"
      pattern: "from [\"']\\.\\./(core/|\\.\\./(core/))"
    - from: "src/core/**/*"
      to: "src/bindings"
      via: "relative imports adding one extra ../ level"
      pattern: "from [\"']\\.\\./(\\.\\./)*(bindings)"
---

<objective>
Move all core system directories (blades, commands, components, hooks, lib, machines, stores, test-utils, assets) into a new src/core/ directory, then fix all import paths across the codebase.

Purpose: Establish the same organizational pattern as extensions -- core system code is self-contained under src/core/, making the project structure cleaner and symmetric with src/extensions/.

Output: Restructured codebase with src/core/ containing all core system code, all imports updated and TypeScript compiling successfully.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/App.tsx
@src/main.tsx
@tsconfig.json
@vite.config.ts
@src/extensions/ExtensionAPI.ts
@src/extensions/ExtensionHost.ts
@src/extensions/extensionSettings.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move core directories into src/core/ using git mv</name>
  <files>
    src/core/blades/
    src/core/commands/
    src/core/components/
    src/core/hooks/
    src/core/lib/
    src/core/machines/
    src/core/stores/
    src/core/test-utils/
    src/core/assets/
  </files>
  <action>
Create the src/core/ directory and move all core system directories into it using `git mv` to preserve git history.

Run these commands:
```bash
mkdir -p src/core
git mv src/blades src/core/blades
git mv src/commands src/core/commands
git mv src/components src/core/components
git mv src/hooks src/core/hooks
git mv src/lib src/core/lib
git mv src/machines src/core/machines
git mv src/stores src/core/stores
git mv src/test-utils src/core/test-utils
git mv src/assets src/core/assets
```

After the move, src/ root should contain ONLY: App.tsx, main.tsx, index.css, bindings.ts, vite-env.d.ts, core/, extensions/
  </action>
  <verify>
Run `ls src/` and confirm only these items exist: App.tsx, main.tsx, index.css, bindings.ts, vite-env.d.ts, core/, extensions/
Run `ls src/core/` and confirm all 9 directories are present: blades, commands, components, hooks, lib, machines, stores, test-utils, assets
  </verify>
  <done>All core directories successfully moved into src/core/ with git history preserved</done>
</task>

<task type="auto">
  <name>Task 2: Fix all import paths across the entire codebase</name>
  <files>
    src/App.tsx
    src/main.tsx
    src/extensions/ExtensionAPI.ts
    src/extensions/ExtensionHost.ts
    src/extensions/extensionSettings.ts
    "All files under src/core/ that import bindings.ts"
    "All extension files that import from core directories"
  </files>
  <action>
Fix all broken imports after the directory move. There are 4 categories of import fixes:

**Category 1: src/App.tsx (stays at src/ root)**
All imports like `./blades/...`, `./commands/...`, `./components/...`, `./hooks/...`, `./machines/...`, `./stores/...` must become `./core/blades/...`, `./core/commands/...`, `./core/components/...`, `./core/hooks/...`, `./core/machines/...`, `./core/stores/...`.

Update these import prefixes in App.tsx:
- `"./blades/` -> `"./core/blades/`
- `"./commands` -> `"./core/commands`  (note: some are bare `"./commands"` side-effect imports)
- `"./components/` -> `"./core/components/`
- `"./hooks/` -> `"./core/hooks/`
- `"./machines/` -> `"./core/machines/`
- `"./stores/` -> `"./core/stores/`

**Category 2: src/main.tsx (stays at src/ root)**
Update `"./lib/` -> `"./core/lib/`

**Category 3: Files inside src/core/ that import bindings.ts**
Since core/ is now one level deeper than before, all bindings imports need an extra `../`:
- Files at depth 1 (e.g., src/core/commands/sync.ts): `"../bindings"` -> `"../../bindings"`
- Files at depth 2 (e.g., src/core/components/clone/CloneDialog.tsx): `"../../bindings"` -> `"../../../bindings"`
- Files at depth 3 (e.g., src/core/stores/domain/git-ops/...): `"../../../bindings"` -> `"../../../../bindings"`

Use sed to do bulk replacement across all .ts/.tsx files under src/core/ for bindings imports. Be careful to only match the exact patterns (not partial matches).

Use these sed commands (run from project root):
```bash
# Fix bindings imports in core files - depth 1 (core/X/file.ts)
find src/core -maxdepth 2 -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from "../bindings"|from "../../bindings"|g'

# Fix bindings imports in core files - depth 2 (core/X/Y/file.ts)
find src/core -mindepth 3 -maxdepth 3 -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from "../../bindings"|from "../../../bindings"|g'

# Fix bindings imports in core files - depth 3 (core/X/Y/Z/file.ts)
find src/core -mindepth 4 -maxdepth 4 -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from "../../../bindings"|from "../../../../bindings"|g'
```

IMPORTANT: Run these depth-specific commands in order from shallowest to deepest to avoid double-replacing.

WAIT -- the above naive approach is wrong because sed processes files at all depths. Instead, use a smarter approach: since ALL files under src/core/ moved one level deeper, EVERY relative import to bindings just needs one more `../` prepended. Use a single regex that adds `../` before `bindings`:

```bash
find src/core -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from "\(\.\./\)*bindings"|from "../\1bindings"|g'
```

Actually, the safest approach is to just run the TypeScript compiler after each category of fixes and use the error output to identify remaining broken imports, then fix those specifically. But for efficiency, handle it with targeted sed commands and then validate.

**Category 4: Extension files that import from core directories**

Extension files at src/extensions/ (depth 1, e.g., ExtensionAPI.ts) import like `"../lib/..."`, `"../stores/..."`, `"../machines/..."`. These need to become `"../core/lib/..."`, `"../core/stores/..."`, `"../core/machines/..."`.

Extension files at src/extensions/X/ (depth 2) import like `"../../lib/..."`, `"../../stores/..."`, `"../../blades/..."`. These need `"../../core/lib/..."`, etc.

Extension files at src/extensions/X/Y/ (depth 3) import like `"../../../lib/..."`, `"../../../bindings"`. The bindings import does NOT change (bindings is still at src/). Only imports to lib/, stores/, blades/, components/, hooks/, machines/, commands/ need the `core/` insertion.

The core directories to match in extension imports: lib, stores, blades, components, hooks, machines, commands, assets, test-utils.

For extension imports, insert `/core` before the directory name in the path:
```bash
# Pattern: find ../lib/ or ../../lib/ or ../../../lib/ in extensions and insert core/ before the directory
# For each core directory name:
for dir in lib stores blades components hooks machines commands assets test-utils; do
  find src/extensions -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from \"\(\.\./\)*${dir}/|from \"\1core/${dir}/|g"
  find src/extensions -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from \"\(\.\./\)*${dir}\"|from \"\1core/${dir}\"|g"
done
```

CRITICAL: Do NOT modify extension imports that reference `../bindings` -- bindings.ts stays at src/ root so the path `../bindings` from src/extensions/X.ts is still correct. Similarly `../../bindings` from src/extensions/X/Y.ts and `../../../bindings` from src/extensions/X/Y/Z.ts are still correct since bindings did NOT move.

After all sed operations, run TypeScript compilation to verify:
```bash
npx tsc --noEmit 2>&1 | grep -v "TS2440" | head -50
```

If there are remaining errors, fix them manually by reading each erroring file and correcting its imports.

Also update tsconfig.json if needed -- the `"include": ["src"]` should still work since core/ is under src/.

**Also check for any non-import references** that might break:
- Vitest config referencing test paths
- Any scripts or config that hardcode src/ subdirectory paths
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "TS2440"` -- should produce no errors (ignoring the pre-existing TS2440 in bindings.ts).
Run `npx vite build 2>&1 | tail -20` -- should build successfully.
Run `npx vitest run --reporter=verbose 2>&1 | tail -30` -- existing tests should pass.
  </verify>
  <done>
All imports resolve correctly. TypeScript compiles with no new errors. The application builds successfully. All existing tests pass. The src/core/ structure mirrors extensions pattern with blades/, commands/, components/, hooks/, lib/, machines/, stores/ directories.
  </done>
</task>

</tasks>

<verification>
1. `ls src/` shows only: App.tsx, main.tsx, index.css, bindings.ts, vite-env.d.ts, core/, extensions/
2. `ls src/core/` shows: assets, blades, commands, components, hooks, lib, machines, stores, test-utils
3. `npx tsc --noEmit` passes (ignoring pre-existing TS2440)
4. `npx vite build` succeeds
5. `npx vitest run` passes
6. No circular dependency or import resolution warnings
</verification>

<success_criteria>
- All 9 core directories (blades, commands, components, hooks, lib, machines, stores, test-utils, assets) live under src/core/
- src/ root is clean with only entry-point files (App.tsx, main.tsx, index.css, bindings.ts, vite-env.d.ts) plus core/ and extensions/
- TypeScript compiles successfully
- Vite build succeeds
- All existing tests pass
- Git history is preserved via git mv
</success_criteria>

<output>
After completion, create `.planning/quick/42-create-a-folder-src-core-same-structure-/42-SUMMARY.md`
</output>
