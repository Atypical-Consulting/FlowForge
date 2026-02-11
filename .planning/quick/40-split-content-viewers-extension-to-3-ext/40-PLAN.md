---
phase: 40-split-content-viewers-extension-to-3-ext
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/extensions/viewer-code/index.ts
  - src/extensions/viewer-code/blades/ViewerCodeBlade.tsx
  - src/extensions/viewer-code/blades/ViewerCodeBlade.test.tsx
  - src/extensions/viewer-markdown/index.ts
  - src/extensions/viewer-markdown/blades/ViewerMarkdownBlade.tsx
  - src/extensions/viewer-markdown/blades/ViewerMarkdownBlade.test.tsx
  - src/extensions/viewer-3d/index.ts
  - src/extensions/viewer-3d/blades/Viewer3dBlade.tsx
  - src/extensions/viewer-3d/blades/Viewer3dBlade.test.tsx
  - src/extensions/__tests__/viewer-code.test.ts
  - src/extensions/__tests__/viewer-markdown.test.ts
  - src/extensions/__tests__/viewer-3d.test.ts
  - src/App.tsx
autonomous: true

must_haves:
  truths:
    - "Each viewer has its own independent extension directory"
    - "All 3 viewers remain registered and functional"
    - "App.tsx registers 3 separate built-in extensions"
    - "Old content-viewers directory is removed"
  artifacts:
    - path: "src/extensions/viewer-code/index.ts"
      provides: "Code viewer extension entry point"
      exports: ["onActivate", "onDeactivate"]
    - path: "src/extensions/viewer-markdown/index.ts"
      provides: "Markdown viewer extension entry point"
      exports: ["onActivate", "onDeactivate"]
    - path: "src/extensions/viewer-3d/index.ts"
      provides: "3D viewer extension entry point"
      exports: ["onActivate", "onDeactivate"]
    - path: "src/App.tsx"
      provides: "Extension registration"
      contains: "registerBuiltIn.*viewer-code"
  key_links:
    - from: "src/App.tsx"
      to: "src/extensions/viewer-code/index.ts"
      via: "import statement"
      pattern: "import.*viewer-code"
    - from: "src/App.tsx"
      to: "src/extensions/viewer-markdown/index.ts"
      via: "import statement"
      pattern: "import.*viewer-markdown"
    - from: "src/App.tsx"
      to: "src/extensions/viewer-3d/index.ts"
      via: "import statement"
      pattern: "import.*viewer-3d"
---

<objective>
Split the monolithic content-viewers extension into 3 independent extensions for better modularity and maintainability.

Purpose: Each viewer type (code, markdown, 3D) becomes its own extension, allowing independent activation/deactivation and clearer separation of concerns.

Output: 3 new extension directories (viewer-code, viewer-markdown, viewer-3d) with their own index.ts, blade components, and tests.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/extensions/content-viewers/index.ts
@src/extensions/content-viewers/blades/ViewerCodeBlade.tsx
@src/extensions/content-viewers/blades/ViewerMarkdownBlade.tsx
@src/extensions/content-viewers/blades/Viewer3dBlade.tsx
@src/App.tsx
</context>

<tasks>

<task type="auto">
  <name>Create 3 independent extension directories</name>
  <files>
    src/extensions/viewer-code/index.ts
    src/extensions/viewer-code/blades/ViewerCodeBlade.tsx
    src/extensions/viewer-code/blades/ViewerCodeBlade.test.tsx
    src/extensions/viewer-markdown/index.ts
    src/extensions/viewer-markdown/blades/ViewerMarkdownBlade.tsx
    src/extensions/viewer-markdown/blades/ViewerMarkdownBlade.test.tsx
    src/extensions/viewer-3d/index.ts
    src/extensions/viewer-3d/blades/Viewer3dBlade.tsx
    src/extensions/viewer-3d/blades/Viewer3dBlade.test.tsx
  </files>
  <action>
    Create 3 new extension directories under src/extensions/:

    **viewer-code extension:**
    - Create src/extensions/viewer-code/index.ts with onActivate/onDeactivate
    - onActivate registers only the viewer-code blade (lazy import from ./blades/ViewerCodeBlade.tsx)
    - Move ViewerCodeBlade.tsx and ViewerCodeBlade.test.tsx to src/extensions/viewer-code/blades/
    - Keep coreOverride: true, lazy: true, and renderPathBreadcrumb pattern

    **viewer-markdown extension:**
    - Create src/extensions/viewer-markdown/index.ts with onActivate/onDeactivate
    - onActivate registers only the viewer-markdown blade (lazy import from ./blades/ViewerMarkdownBlade.tsx)
    - Move ViewerMarkdownBlade.tsx and ViewerMarkdownBlade.test.tsx to src/extensions/viewer-markdown/blades/
    - Keep coreOverride: true, lazy: true, and renderPathBreadcrumb pattern

    **viewer-3d extension:**
    - Create src/extensions/viewer-3d/index.ts with onActivate/onDeactivate
    - onActivate registers only the viewer-3d blade (lazy import from ./blades/Viewer3dBlade.tsx)
    - Move Viewer3dBlade.tsx and Viewer3dBlade.test.tsx to src/extensions/viewer-3d/blades/
    - Keep coreOverride: true, lazy: true, and renderPathBreadcrumb pattern

    Each index.ts follows the same pattern as the original content-viewers/index.ts but registers only one blade type. Import renderPathBreadcrumb from "../../lib/bladeUtils".
  </action>
  <verify>
    All 3 directories exist with correct structure:
    ls -la src/extensions/viewer-code/ src/extensions/viewer-markdown/ src/extensions/viewer-3d/

    Each has index.ts and blades/ subdirectory with component + test.
  </verify>
  <done>
    9 new files created across 3 extension directories, each extension has its own index.ts registering one blade type with coreOverride: true.
  </done>
</task>

<task type="auto">
  <name>Update App.tsx registration and create integration tests</name>
  <files>
    src/App.tsx
    src/extensions/__tests__/viewer-code.test.ts
    src/extensions/__tests__/viewer-markdown.test.ts
    src/extensions/__tests__/viewer-3d.test.ts
  </files>
  <action>
    **Update App.tsx:**
    - Remove old content-viewers import (line 26)
    - Add 3 new imports:
      ```typescript
      import { onActivate as viewerCodeActivate, onDeactivate as viewerCodeDeactivate } from "./extensions/viewer-code";
      import { onActivate as viewerMarkdownActivate, onDeactivate as viewerMarkdownDeactivate } from "./extensions/viewer-markdown";
      import { onActivate as viewer3dActivate, onDeactivate as viewer3dDeactivate } from "./extensions/viewer-3d";
      ```
    - Remove old content-viewers registerBuiltIn block (lines 65-71)
    - Add 3 new registerBuiltIn blocks:
      ```typescript
      registerBuiltIn({
        id: "viewer-code",
        name: "Code Viewer",
        version: "1.0.0",
        activate: viewerCodeActivate,
        deactivate: viewerCodeDeactivate,
      });

      registerBuiltIn({
        id: "viewer-markdown",
        name: "Markdown Viewer",
        version: "1.0.0",
        activate: viewerMarkdownActivate,
        deactivate: viewerMarkdownDeactivate,
      });

      registerBuiltIn({
        id: "viewer-3d",
        name: "3D Model Viewer",
        version: "1.0.0",
        activate: viewer3dActivate,
        deactivate: viewer3dDeactivate,
      });
      ```

    **Create 3 integration tests:**
    - Split content-viewers.test.ts into 3 separate test files
    - viewer-code.test.ts: Test viewer-code extension registration and blade
    - viewer-markdown.test.ts: Test viewer-markdown extension registration and blade
    - viewer-3d.test.ts: Test viewer-3d extension registration and blade
    - Each test follows same pattern as original but for single extension
  </action>
  <verify>
    App.tsx imports 3 extensions:
    grep -E "viewer-(code|markdown|3d)" src/App.tsx

    3 registerBuiltIn blocks exist:
    grep -c "registerBuiltIn" src/App.tsx | grep -E "[9-9]|[1-9][0-9]"

    3 integration tests exist:
    ls src/extensions/__tests__/viewer-*.test.ts
  </verify>
  <done>
    App.tsx registers 3 independent viewer extensions, old content-viewers import removed, 3 integration tests created and passing.
  </done>
</task>

<task type="auto">
  <name>Remove old content-viewers directory and verify</name>
  <files>
    src/extensions/content-viewers/
    src/extensions/__tests__/content-viewers.test.ts
  </files>
  <action>
    Remove the old content-viewers extension completely:
    - Delete src/extensions/content-viewers/ directory (including index.ts and blades/)
    - Delete src/extensions/__tests__/content-viewers.test.ts

    Run type check and tests to ensure no broken imports:
    - npm run type-check (ignore pre-existing TS2440 error)
    - npm test -- viewer-code.test
    - npm test -- viewer-markdown.test
    - npm test -- viewer-3d.test
  </action>
  <verify>
    Old directory gone:
    ! ls src/extensions/content-viewers/ 2>/dev/null

    Old integration test gone:
    ! ls src/extensions/__tests__/content-viewers.test.ts 2>/dev/null

    Type check passes:
    npm run type-check 2>&1 | grep -E "Found 0 errors|TS2440" || echo "Type check passed"

    All 3 viewer tests pass:
    npm test -- viewer-code.test && npm test -- viewer-markdown.test && npm test -- viewer-3d.test
  </verify>
  <done>
    Old content-viewers directory removed, no broken imports, all 3 new viewer extension tests passing, type check clean (except pre-existing TS2440).
  </done>
</task>

</tasks>

<verification>
## Overall verification

1. **Structure check:**
   ```bash
   ls -la src/extensions/viewer-*/
   ```
   Should show 3 extension directories with index.ts and blades/ subdirectories.

2. **App.tsx registration:**
   ```bash
   grep "viewer-code\|viewer-markdown\|viewer-3d" src/App.tsx
   ```
   Should show 3 imports and 3 registerBuiltIn calls.

3. **No old references:**
   ```bash
   ! grep -r "content-viewers" src/ 2>/dev/null
   ```
   Should find no references to old extension name.

4. **Tests pass:**
   ```bash
   npm test -- viewer-
   ```
   All 3 viewer tests pass.
</verification>

<success_criteria>
- 3 independent extension directories exist (viewer-code, viewer-markdown, viewer-3d)
- Each extension has its own index.ts, blade component, and test file
- App.tsx registers 3 separate built-in extensions instead of 1
- Old content-viewers directory and test completely removed
- All 3 new integration tests pass
- Type check passes (except pre-existing TS2440)
- No broken imports or references to old content-viewers extension
</success_criteria>

<output>
After completion, create `.planning/quick/40-split-content-viewers-extension-to-3-ext/40-SUMMARY.md` documenting the refactor.
</output>
