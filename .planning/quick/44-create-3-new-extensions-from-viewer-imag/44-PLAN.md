---
phase: quick-44
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # New extension: viewer-image
  - src/extensions/viewer-image/index.ts
  - src/extensions/viewer-image/manifest.json
  - src/extensions/viewer-image/README.md
  - src/extensions/viewer-image/blades/ViewerImageBlade.tsx
  - src/extensions/viewer-image/blades/ViewerImageBlade.test.tsx
  # New extension: viewer-nupkg
  - src/extensions/viewer-nupkg/index.ts
  - src/extensions/viewer-nupkg/manifest.json
  - src/extensions/viewer-nupkg/README.md
  - src/extensions/viewer-nupkg/blades/ViewerNupkgBlade.tsx
  - src/extensions/viewer-nupkg/blades/ViewerNupkgBlade.test.tsx
  - src/extensions/viewer-nupkg/components/NugetPackageViewer.tsx
  # New extension: viewer-plaintext
  - src/extensions/viewer-plaintext/index.ts
  - src/extensions/viewer-plaintext/manifest.json
  - src/extensions/viewer-plaintext/README.md
  - src/extensions/viewer-plaintext/blades/ViewerPlaintextBlade.tsx
  - src/extensions/viewer-plaintext/blades/ViewerPlaintextBlade.test.tsx
  # Modified files
  - src/App.tsx
  - src/extensions/extensionCategories.ts
  - src/core/blades/_discovery.ts
  # Deleted old files
  - src/core/blades/viewer-image/index.ts
  - src/core/blades/viewer-image/registration.ts
  - src/core/blades/viewer-image/ViewerImageBlade.tsx
  - src/core/blades/viewer-image/ViewerImageBlade.test.tsx
  - src/core/blades/viewer-nupkg/index.ts
  - src/core/blades/viewer-nupkg/registration.ts
  - src/core/blades/viewer-nupkg/ViewerNupkgBlade.tsx
  - src/core/blades/viewer-nupkg/ViewerNupkgBlade.test.tsx
  - src/core/blades/viewer-plaintext/index.ts
  - src/core/blades/viewer-plaintext/registration.ts
  - src/core/blades/viewer-plaintext/ViewerPlaintextBlade.tsx
  - src/core/blades/viewer-plaintext/ViewerPlaintextBlade.test.tsx
  - src/core/components/viewers/NugetPackageViewer.tsx
autonomous: true
must_haves:
  truths:
    - "viewer-image, viewer-nupkg, viewer-plaintext are proper extensions under src/extensions/"
    - "Each extension follows the standard directory convention (README.md, manifest.json, index.ts, blades/)"
    - "Extensions register via ExtensionHost registerBuiltIn in App.tsx with coreOverride: true"
    - "Old core/blades/viewer-{image,nupkg,plaintext} directories are deleted"
    - "NugetPackageViewer component moves into viewer-nupkg extension"
    - "_discovery.ts no longer lists viewer-image, viewer-nupkg, viewer-plaintext in EXPECTED_TYPES"
    - "All existing tests pass (no broken imports)"
  artifacts:
    - path: "src/extensions/viewer-image/index.ts"
      provides: "Extension entry point with onActivate/onDeactivate"
      exports: ["onActivate", "onDeactivate"]
    - path: "src/extensions/viewer-nupkg/index.ts"
      provides: "Extension entry point with onActivate/onDeactivate"
      exports: ["onActivate", "onDeactivate"]
    - path: "src/extensions/viewer-plaintext/index.ts"
      provides: "Extension entry point with onActivate/onDeactivate"
      exports: ["onActivate", "onDeactivate"]
  key_links:
    - from: "src/App.tsx"
      to: "src/extensions/viewer-image/index.ts"
      via: "import + registerBuiltIn"
      pattern: "registerBuiltIn.*viewer-image"
    - from: "src/App.tsx"
      to: "src/extensions/viewer-nupkg/index.ts"
      via: "import + registerBuiltIn"
      pattern: "registerBuiltIn.*viewer-nupkg"
    - from: "src/App.tsx"
      to: "src/extensions/viewer-plaintext/index.ts"
      via: "import + registerBuiltIn"
      pattern: "registerBuiltIn.*viewer-plaintext"
---

<objective>
Create 3 new extensions (viewer-image, viewer-nupkg, viewer-plaintext) by extracting blade components from src/core/blades/ into proper src/extensions/ directories, following the exact same pattern as the already-extracted viewer-code, viewer-markdown, and viewer-3d extensions.

Purpose: Continue the "Extensions Everywhere" refactoring to move all viewer blades into self-contained extensions.
Output: Three new extension directories with proper structure, App.tsx registrations, old core blade directories deleted.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/extensions/viewer-code/index.ts (pattern to follow for index.ts)
@src/extensions/viewer-code/manifest.json (pattern to follow for manifest.json)
@src/extensions/viewer-code/README.md (pattern to follow for README.md)
@src/extensions/viewer-3d/index.ts (another reference)
@src/App.tsx (add registerBuiltIn calls)
@src/extensions/extensionCategories.ts (add category mappings)
@src/core/blades/_discovery.ts (remove from EXPECTED_TYPES)
@src/core/blades/viewer-image/ (source files to move)
@src/core/blades/viewer-nupkg/ (source files to move)
@src/core/blades/viewer-plaintext/ (source files to move)
@src/core/components/viewers/NugetPackageViewer.tsx (move into viewer-nupkg extension)
@src/core/stores/bladeTypes.ts (blade types already defined - no change needed)
@src/core/lib/fileDispatch.ts (already maps file extensions - no change needed)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the 3 new extension directories with proper structure</name>
  <files>
    src/extensions/viewer-image/index.ts
    src/extensions/viewer-image/manifest.json
    src/extensions/viewer-image/README.md
    src/extensions/viewer-image/blades/ViewerImageBlade.tsx
    src/extensions/viewer-image/blades/ViewerImageBlade.test.tsx
    src/extensions/viewer-nupkg/index.ts
    src/extensions/viewer-nupkg/manifest.json
    src/extensions/viewer-nupkg/README.md
    src/extensions/viewer-nupkg/blades/ViewerNupkgBlade.tsx
    src/extensions/viewer-nupkg/blades/ViewerNupkgBlade.test.tsx
    src/extensions/viewer-nupkg/components/NugetPackageViewer.tsx
    src/extensions/viewer-plaintext/index.ts
    src/extensions/viewer-plaintext/manifest.json
    src/extensions/viewer-plaintext/README.md
    src/extensions/viewer-plaintext/blades/ViewerPlaintextBlade.tsx
    src/extensions/viewer-plaintext/blades/ViewerPlaintextBlade.test.tsx
  </files>
  <action>
    Create 3 new extension directories following the exact same pattern as viewer-code and viewer-markdown.

    **For each extension (viewer-image, viewer-nupkg, viewer-plaintext):**

    1. **manifest.json** - Follow viewer-code/manifest.json pattern:
       - viewer-image: id "viewer-image", name "Image Viewer", description about image preview with base64 loading
       - viewer-nupkg: id "viewer-nupkg", name "NuGet Package Viewer", description about NuGet package info from NuGet.org
       - viewer-plaintext: id "viewer-plaintext", name "Plain Text Viewer", description about plain text file viewing
       - All: apiVersion "1", main "index.ts", contributes.blades with appropriate type/title, trustLevel "built-in"

    2. **index.ts** - Follow viewer-code/index.ts pattern exactly:
       - Import `lazy` from "react", `ExtensionAPI` from "../ExtensionAPI", `renderPathBreadcrumb` from "../../core/lib/bladeUtils"
       - Export `onActivate(api: ExtensionAPI)` that lazy-imports the blade component and calls `api.registerBlade({ type, title, component, lazy: true, coreOverride: true, renderTitleContent })`
       - Export `onDeactivate()` as no-op
       - Title function: `(props: any) => props.filePath?.split("/").pop() || "FallbackTitle"`
       - For viewer-nupkg: title fallback "Package", for viewer-image: "Image", for viewer-plaintext: "Plain Text"
       - Note: viewer-nupkg currently does NOT use lazy loading (it imports directly). Convert it to lazy loading to match the pattern.

    3. **blades/ViewerXxxBlade.tsx** - Move from src/core/blades/viewer-xxx/:
       - viewer-image: Copy ViewerImageBlade.tsx. Update import paths:
         - `../../../bindings` -> `../../../bindings` (stays same since depth is same from extensions/)
         - `../../lib/errors` -> `../../../core/lib/errors`
       - viewer-nupkg: Copy ViewerNupkgBlade.tsx. Update import:
         - `../../components/viewers/NugetPackageViewer` -> `../components/NugetPackageViewer`
         - `../../../bindings` -> `../../../bindings` (stays same)
       - viewer-plaintext: Copy ViewerPlaintextBlade.tsx. Update imports:
         - `../../hooks/useRepoFile` -> `../../../core/hooks/useRepoFile`
         - `../_shared/BladeContentLoading` -> `../../../core/blades/_shared/BladeContentLoading`
         - `../_shared/BladeContentError` -> `../../../core/blades/_shared/BladeContentError`
         - `../_shared/BladeContentEmpty` -> `../../../core/blades/_shared/BladeContentEmpty`

    4. **blades/ViewerXxxBlade.test.tsx** - Move from src/core/blades/viewer-xxx/:
       - viewer-image: Copy test. Update `../../test-utils/render` -> `../../../core/test-utils/render`, `../../../bindings` stays same
       - viewer-nupkg: Copy test. Update `../../test-utils/render` -> `../../../core/test-utils/render`, `../../../bindings` stays same
       - viewer-plaintext: Copy test. Update `../../test-utils/render` -> `../../../core/test-utils/render`, `../../../bindings` stays same

    5. **viewer-nupkg/components/NugetPackageViewer.tsx** - Move from src/core/components/viewers/:
       - Copy NugetPackageViewer.tsx into the extension's components/ directory
       - Update import: `../../../bindings` -> `../../../bindings` (same depth)
       - Update import: `./ViewerRegistry` -> `../../../core/components/viewers/ViewerRegistry` (keep ViewerProps type reference)

    6. **README.md** - Follow viewer-code/README.md pattern:
       - viewer-image: "Image Viewer" with description about base64 image loading from working tree or commit
       - viewer-nupkg: "NuGet Package Viewer" with description about parsing .nupkg filenames and fetching info from NuGet.org. Note components/ dir in file structure.
       - viewer-plaintext: "Plain Text Viewer" with description about displaying plain text with useRepoFile hook
       - Include file structure, blades table, commands/toolbar sections (none), extension directory convention details block
  </action>
  <verify>
    ls src/extensions/viewer-image/ src/extensions/viewer-nupkg/ src/extensions/viewer-plaintext/
    # Each should have: index.ts, manifest.json, README.md, blades/
    # viewer-nupkg should also have components/NugetPackageViewer.tsx
  </verify>
  <done>All 3 extension directories exist with index.ts, manifest.json, README.md, blades/ with component + test, and viewer-nupkg has components/NugetPackageViewer.tsx</done>
</task>

<task type="auto">
  <name>Task 2: Wire extensions into App.tsx, update categories, remove old core blade files</name>
  <files>
    src/App.tsx
    src/extensions/extensionCategories.ts
    src/core/blades/_discovery.ts
    src/extensions/__tests__/viewer-image.test.ts
    src/extensions/__tests__/viewer-nupkg.test.ts
    src/extensions/__tests__/viewer-plaintext.test.ts
  </files>
  <action>
    **App.tsx** - Add 3 new registerBuiltIn calls following the exact pattern of existing ones:

    Add imports at the top (after the existing viewer imports around line 28):
    ```
    import { onActivate as viewerImageActivate, onDeactivate as viewerImageDeactivate } from "./extensions/viewer-image";
    import { onActivate as viewerNupkgActivate, onDeactivate as viewerNupkgDeactivate } from "./extensions/viewer-nupkg";
    import { onActivate as viewerPlaintextActivate, onDeactivate as viewerPlaintextDeactivate } from "./extensions/viewer-plaintext";
    ```

    Add 3 registerBuiltIn calls in the useEffect (after the viewer-3d registration around line 89):
    ```
    registerBuiltIn({ id: "viewer-image", name: "Image Viewer", version: "1.0.0", activate: viewerImageActivate, deactivate: viewerImageDeactivate });
    registerBuiltIn({ id: "viewer-nupkg", name: "NuGet Package Viewer", version: "1.0.0", activate: viewerNupkgActivate, deactivate: viewerNupkgDeactivate });
    registerBuiltIn({ id: "viewer-plaintext", name: "Plain Text Viewer", version: "1.0.0", activate: viewerPlaintextActivate, deactivate: viewerPlaintextDeactivate });
    ```

    **extensionCategories.ts** - Add 3 new entries to EXTENSION_CATEGORIES:
    ```
    "viewer-image": "viewers",
    "viewer-nupkg": "viewers",
    "viewer-plaintext": "viewers",
    ```

    **_discovery.ts** - Remove "viewer-nupkg", "viewer-image", "viewer-plaintext" from the EXPECTED_TYPES array (they are now extensions, not core blades).

    **Extension tests** - Create 3 test files following the exact pattern of src/extensions/__tests__/viewer-code.test.ts:
    - viewer-image.test.ts: Test onActivate registers "viewer-image" blade, coreOverride (no ext: prefix), lazy flag, source tracking, cleanup, onDeactivate no-op
    - viewer-nupkg.test.ts: Same pattern for "viewer-nupkg" blade type. Note: since we're now using lazy loading, test lazy: true as well.
    - viewer-plaintext.test.ts: Same pattern for "viewer-plaintext" blade type

    **Delete old core blade directories** (use `rm -rf`):
    - src/core/blades/viewer-image/
    - src/core/blades/viewer-nupkg/
    - src/core/blades/viewer-plaintext/
    - src/core/components/viewers/NugetPackageViewer.tsx

    **Check if ViewerRegistry.ts is still used by other files.** If NugetPackageViewer.tsx was the only consumer of ViewerProps from ViewerRegistry.ts, and if ViewerRegistry.ts still has other consumers (like previewRegistrations.ts), leave it. Otherwise, leave it anyway (it's a shared type).
  </action>
  <verify>
    # Verify TypeScript compiles (ignoring pre-existing TS2440 in bindings.ts)
    npx tsc --noEmit 2>&1 | grep -v "bindings.ts"

    # Verify tests pass
    npx vitest run --reporter=verbose 2>&1 | tail -30

    # Verify old directories are gone
    ls src/core/blades/viewer-image/ 2>&1  # Should fail (not found)
    ls src/core/blades/viewer-nupkg/ 2>&1  # Should fail (not found)
    ls src/core/blades/viewer-plaintext/ 2>&1  # Should fail (not found)
  </verify>
  <done>App.tsx registers all 3 new extensions via registerBuiltIn, extensionCategories.ts includes the 3 new viewers, _discovery.ts no longer expects the 3 viewer types, old core blade directories deleted, TypeScript compiles, all tests pass</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes (ignoring pre-existing bindings.ts TS2440)
- `npx vitest run` all tests pass
- Each new extension has: manifest.json, index.ts (onActivate/onDeactivate), README.md, blades/ directory
- App.tsx has registerBuiltIn for viewer-image, viewer-nupkg, viewer-plaintext
- extensionCategories.ts maps all 3 to "viewers"
- No files remain under src/core/blades/viewer-{image,nupkg,plaintext}/
- src/core/components/viewers/NugetPackageViewer.tsx is deleted (moved to extension)
</verification>

<success_criteria>
- 3 new extensions created under src/extensions/ following the standard convention
- All viewer blades extracted from core into extensions with coreOverride: true
- No broken imports or type errors
- All existing + new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/44-create-3-new-extensions-from-viewer-imag/44-SUMMARY.md`
</output>
