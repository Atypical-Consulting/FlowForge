# Phase 38: Content Viewer Extraction - UX & Graceful Degradation Research

**Researched:** 2026-02-10
**Domain:** UX flow, file dispatch, graceful degradation, extensibility
**Confidence:** HIGH
**Researcher:** UX & Graceful Degradation Specialist

## Summary

The current FlowForge codebase has **five file viewer blades** (viewer-code, viewer-image, viewer-markdown, viewer-3d, viewer-nupkg) that are registered as core blades via eager side-effect imports in `_discovery.ts`. File routing is controlled by two systems: `fileDispatch.ts` (a static `ReadonlyMap` mapping file extensions to blade types) and `previewRegistry.ts` (a priority-sorted matcher array for inline staging previews). Both systems currently assume all viewers exist at module load time. Phase 38 must extract the viewer blades to a built-in extension while preserving the user experience and providing graceful degradation when the extension is disabled.

The existing extension system from Phase 37 provides all the primitives needed: `registerBuiltIn()`, `ExtensionAPI.registerBlade()`, namespaced blade types, and automatic cleanup on deactivation. However, two critical capabilities are **missing**: (1) an `api.registerFileDispatch()` method to extend file-to-blade-type routing, and (2) an `api.registerPreview()` method to register inline staging preview handlers. These must be added in Phase 38.

**Primary recommendation:** Create `src/extensions/content-viewers/index.ts` as a built-in extension that registers all viewer blades and file dispatch mappings via ExtensionAPI. Make `fileDispatch.ts` support extension overlays. Add a `registrationTick` to the preview registry for reactive re-renders. When the extension is disabled, the system falls back to `viewer-code` (plain text display) for browse context and `diff` (inline text diff) for staging context.

## Standard Stack

### Core (All Already In Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | Component framework | Already used throughout |
| Zustand | 4+ | State management, registries | All registries use Zustand stores |
| XState | 5+ | Navigation state machine | Blade stack management |
| @monaco-editor/react | - | Code viewer component | Already used in ViewerCodeBlade |
| three | - | 3D model viewer | Already used in Viewer3dBlade |
| @tanstack/react-query | - | Data fetching/caching | Already used for file loading |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | - | Icons for fallback states | Already used throughout |
| framer-motion | - | Blade transition animations | Already used in BladeContainer |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand registry for file dispatch | Keep static Map | Static map cannot be extended by extensions at runtime |
| registrationTick counter | EventEmitter pattern | Zustand's reactive model is simpler and already proven in toolbarRegistry |

**Installation:**
No new dependencies needed. Everything is already in the project.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── extensions/
│   └── content-viewers/
│       ├── index.ts              # onActivate/onDeactivate entry point
│       ├── blades/               # Moved blade components (or lazy imports)
│       └── registrations.ts      # Preview registry registrations
├── lib/
│   ├── fileDispatch.ts           # MODIFIED: support extension overlay
│   ├── previewRegistry.ts        # MODIFIED: add registrationTick, source tracking
│   └── bladeRegistry.ts          # Unchanged (already supports extension blades)
└── blades/
    └── _discovery.ts             # MODIFIED: remove viewer-* from EXPECTED_TYPES
```

### Pattern 1: Current User Journey — File Opening from Repo Browser

**What:** User clicks a file in the repo-browser blade. The `openFile` callback in `RepoBrowserBlade.tsx` calls `bladeTypeForFile(entry.path, "browse")` which consults `fileDispatch.ts`'s static `FILE_DISPATCH_MAP`. Based on the returned blade type, it pushes the corresponding viewer blade onto the navigation stack.

**Current flow (browse context):**
```
User clicks "README.md" in RepoBrowserBlade
  -> openFile(entry) at RepoBrowserBlade.tsx:60-83
  -> bladeTypeForFile("README.md", "browse") at fileDispatch.ts:55-69
  -> FILE_DISPATCH_MAP.get("md") returns "viewer-markdown"
  -> pushBlade({ type: "viewer-markdown", title: "README.md", props: { filePath: "README.md" } })
  -> NavigationMachine.PUSH_BLADE -> adds blade to stack
  -> BladeRenderer looks up "viewer-markdown" in bladeRegistry
  -> Renders <ViewerMarkdownBlade filePath="README.md" />
```

**Current flow (staging context):**
```
User clicks a file in StagingChangesBlade
  -> openStagingDiff(file, section) at useBladeNavigation.ts:69-93
  -> bladeTypeForFile(file.path) from fileTypeUtils.ts (re-exports fileDispatch.ts)
  -> For .md files: returns "viewer-markdown" -> routes to diff blade with staging source
  -> For images: returns "viewer-image" -> pushes viewer-image blade
  -> For .glb/.gltf: returns "viewer-3d" -> pushes viewer-3d blade
  -> For other files: returns "diff" -> pushes diff blade (inline text diff)
```

**Current flow (inline staging preview):**
```
User selects a file in StagingChangesBlade file list
  -> StagingDiffPreview renders inline preview
  -> getPreviewForFile(file.path) at previewRegistry.ts
  -> Matches against priority-sorted PreviewRegistration array
  -> For images: mode "placeholder" -> NonTextPlaceholder with "Image file — click to expand"
  -> For .glb/.gltf: mode "placeholder" -> NonTextPlaceholder with "3D model — click to expand"
  -> For .nupkg: mode "placeholder" -> NonTextPlaceholder with "Archive file — click to expand"
  -> For text files: mode "inline-diff" -> InlineDiffViewer
```

**Source:** `src/blades/repo-browser/RepoBrowserBlade.tsx:60-83`, `src/hooks/useBladeNavigation.ts:50-93`, `src/lib/fileDispatch.ts`, `src/blades/staging-changes/components/StagingDiffPreview.tsx`

### Pattern 2: Blade Registration Side-Effects

**What:** All core blades are registered via eager side-effect imports at module load time. The `_discovery.ts` file uses `import.meta.glob("./*/registration.{ts,tsx}", { eager: true })` to discover and execute all registration files.

**Key detail:** Each `registration.ts` file calls `registerBlade()` directly from `lib/bladeRegistry.ts` as a top-level side effect. This means the blade registry is populated before the first React render. Extension blades (like GitHub) register later via `ExtensionAPI.registerBlade()` which delegates to the same `registerBlade()` function but with namespaced types (e.g., `ext:github:sign-in`).

**Impact on Phase 38:** When viewer blade registrations move from core `registration.ts` files to the content-viewers extension's `onActivate()`, they register asynchronously. The `_discovery.ts` exhaustiveness check must be updated to no longer expect `viewer-*` types. The `fileDispatch.ts` must handle the case where a blade type is mapped but not yet registered (or no longer registered).

**Source:** `src/blades/_discovery.ts`, `src/blades/viewer-markdown/registration.ts`

### Pattern 3: Extension Toggle UX (GitHub Reference)

**What:** The Extension Manager blade shows each extension with a toggle switch. When the user toggles off an extension:
1. `ExtensionCard.handleToggle()` calls `deactivateExtension(extension.id)`
2. `ExtensionHost.deactivateExtension()` calls `module.onDeactivate()` then `api.cleanup()`
3. `api.cleanup()` removes all blade registrations, commands, toolbar items, etc.
4. The extension status is set to "disabled" and persisted

**Current gap:** When the GitHub extension is disabled, any open GitHub blades simply show "Unknown blade: ext:github:sign-in" (the red error text in `BladeRenderer.tsx:17`). This is functional but poor UX.

**Source:** `src/blades/extension-manager/components/ExtensionCard.tsx:32-47`, `src/extensions/ExtensionHost.ts:267-298`, `src/blades/_shared/BladeRenderer.tsx:15-17`

### Anti-Patterns to Avoid

- **Hardcoded blade type mapping in consumers:** RepoBrowserBlade.tsx currently has an if-else chain (lines 70-81) that hardcodes blade type -> props mapping. This should be replaced with a generic dispatch that works for any registered blade type with `filePath` props.

- **Mixing core and extension registrations in fileDispatch:** The `FILE_DISPATCH_MAP` should become an overlay system where extensions add/remove entries, not a single static map that must be modified.

- **Synchronous-only preview registration:** Both `previewRegistry.ts` and `fileDispatch.ts` assume all registrations happen at module load. Extensions activate asynchronously. The registries must support late registration with reactive re-render triggers.

- **Not closing stale blades on extension disable:** If a user has a viewer-markdown blade open and disables the content-viewers extension, the blade's component is unregistered but the blade instance remains on the navigation stack. This must be handled.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File type -> viewer routing | Custom router | Extend fileDispatch.ts with overlay pattern | The existing pattern works, just needs mutability |
| Blade cleanup on extension disable | Custom blade stack walker | Navigation machine event + BladeRenderer fallback | The navigation machine already handles blade lifecycle |
| Reactive re-renders on registry change | Custom event emitter | Zustand registrationTick pattern (proven in toolbarRegistry) | Consistent with existing codebase patterns |
| Plain text fallback viewer | New "plain-text-viewer" blade | Existing viewer-code blade (Monaco) or simple `<pre>` | viewer-code with readOnly is already a text viewer |

**Key insight:** The existing architecture already has all the patterns needed. Phase 38 is about making the file dispatch and preview registries extensible (mutable + overlay) and then moving viewer registrations from core side-effects to extension `onActivate()`.

## Common Pitfalls

### Pitfall 1: Preview Registry Cascade Break (from v1.6.0-PITFALLS.md #9)

**What goes wrong:** Content viewers use TWO separate registries: `bladeRegistry` for full-page viewing and `previewRegistry` for inline staging previews. Extracting the blade registration but forgetting the preview registration breaks staging area previews.

**Why it happens:** `previewRegistrations.ts` (in staging-changes/components/) registers image, archive, 3D, and binary preview handlers eagerly. These are separate from blade registrations.

**How to avoid:**
1. Add `api.registerPreview()` to ExtensionAPI
2. Add `registrationTick` to previewRegistry for reactive re-renders
3. Move preview registrations into the content-viewers extension's onActivate
4. Keep the default text-diff fallback as a core registration that is never extracted

**Warning signs:** Staging blade shows binary gibberish for images or 3D models after extraction.

### Pitfall 2: Race Condition Between Extension Activation and File Opening

**What goes wrong:** User opens a repo and immediately clicks a .md file. The content-viewers extension hasn't activated yet (it activates asynchronously in `App.tsx:72`). `bladeTypeForFile("README.md")` returns the code viewer fallback because no extension dispatch entries exist yet.

**Why it happens:** Extension activation is async. File dispatch lookups are sync. There's a window where the dispatch table has no viewer entries.

**How to avoid:**
1. Register the content-viewers extension in the same `useEffect` as GitHub (App.tsx:59), which fires on mount before any user interaction
2. Use `registerBuiltIn()` which activates inline during the first render
3. The content-viewers extension should register file dispatch entries synchronously in onActivate before any async work

**Warning signs:** First file opened after app launch goes to wrong viewer, subsequent files work correctly.

### Pitfall 3: Open Blades Become Orphaned When Extension Disabled

**What goes wrong:** User has viewer-markdown blade open, disables content-viewers extension. The blade component is unregistered from bladeRegistry but the TypedBlade instance remains on the navigation stack. BladeRenderer shows "Unknown blade: viewer-markdown" in red.

**Why it happens:** Extension cleanup removes registrations but doesn't touch the navigation state machine's blade stack. The blade stack is managed by XState and has no knowledge of extension lifecycle.

**How to avoid:**
1. **Option A (Recommended):** Enhance BladeRenderer to show a meaningful fallback when a blade type is unregistered — e.g., "This content requires the Content Viewers extension. Enable it in Extension Manager." with an "Enable" action button.
2. **Option B:** On extension deactivation, walk the blade stack and replace unregistered viewer blades with a plain-text fallback blade. This is more complex and might surprise users.
3. **Option C:** Close orphaned blades. This is the most disruptive UX.

**Warning signs:** Red "Unknown blade" error text visible after disabling extension.

### Pitfall 4: Extension Blade Types Must Be Namespaced

**What goes wrong:** The content-viewers extension registers blade type "viewer-markdown" (without ext: prefix). This collides with the old core blade type. Or the extension uses `ext:content-viewers:viewer-markdown` which breaks all the hardcoded references to "viewer-markdown" in `useBladeNavigation.ts` and `RepoBrowserBlade.tsx`.

**Why it happens:** The `ExtensionAPI.registerBlade()` automatically namespaces types to `ext:{extensionId}:{config.type}`. But `fileDispatch.ts` and `useBladeNavigation.ts` reference bare blade types like "viewer-markdown".

**How to avoid:**
1. The content-viewers extension registers blades as `ext:content-viewers:viewer-markdown` (automatic via ExtensionAPI)
2. `fileDispatch.ts` overlay entries use the namespaced types
3. `RepoBrowserBlade.tsx` and `useBladeNavigation.ts` read from `bladeTypeForFile()` which returns the extension-namespaced type
4. Remove the hardcoded if-else chain in `RepoBrowserBlade.tsx:70-81` and replace with generic dispatch

**Warning signs:** "Unknown blade" errors with the old non-namespaced type after extraction.

### Pitfall 5: viewer-code Serves Double Duty as Fallback

**What goes wrong:** `viewer-code` (Monaco) is both a specialized viewer for source code AND the fallback for "browse" context when no specialized viewer matches. If viewer-code is extracted to the extension, the fallback path also breaks.

**Why it happens:** `fileDispatch.ts:64-66` returns `"viewer-code"` as the default for browse context. If viewer-code is an extension blade, this default references an unregistered type when the extension is disabled.

**How to avoid:**
1. Keep a minimal plain-text fallback in core that does NOT depend on the content-viewers extension
2. This could be a simple `<pre>` component that reads file content via `useRepoFile` — no Monaco dependency
3. The fallback blade should be a core blade (e.g., "plain-text") always registered in `_discovery.ts`
4. `fileDispatch.ts` default should return "plain-text" (core) not "viewer-code" (extension)

**Warning signs:** Clicking any file in repo browser shows "Unknown blade" when content-viewers is disabled.

## Code Examples

### Example 1: Extension File Dispatch Overlay Pattern

```typescript
// src/lib/fileDispatch.ts — MODIFIED
// Core dispatch entries (minimal fallback, always present)
const CORE_DISPATCH: ReadonlyMap<string, string> = new Map([
  // NO viewer entries here — all viewer mappings come from extensions
]);

// Extension overlay (mutable, managed by extensions)
const extensionDispatch = new Map<string, { bladeType: string; source: string }>();

/** Register file extension -> blade type mapping from an extension */
export function registerFileDispatch(
  extensions: string[],
  bladeType: string,
  source: string,
): void {
  for (const ext of extensions) {
    extensionDispatch.set(ext.toLowerCase(), { bladeType, source });
  }
}

/** Remove all file dispatch entries from a given source */
export function unregisterFileDispatchBySource(source: string): void {
  for (const [ext, entry] of extensionDispatch) {
    if (entry.source === source) {
      extensionDispatch.delete(ext);
    }
  }
}

export function bladeTypeForFile(
  filePath: string,
  context: "diff" | "browse" = "diff",
): string {
  const ext = getExtension(filePath);
  // Extension overlay takes precedence
  const extEntry = extensionDispatch.get(ext);
  if (extEntry) return extEntry.bladeType;
  // Then core dispatch
  const coreEntry = CORE_DISPATCH.get(ext);
  if (coreEntry) return coreEntry;
  // Context-aware fallback to CORE blades (not extension blades)
  return context === "browse" ? "plain-text" : "diff";
}
```
**Source:** Pattern from `.planning/phases/37-extension-platform-foundation/37-ARCHITECTURE-RESEARCH.md:739-769`

### Example 2: Content-Viewers Extension Entry Point

```typescript
// src/extensions/content-viewers/index.ts
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy-load blade components
  const [
    { ViewerMarkdownBlade },
    { ViewerCodeBlade },
    { Viewer3dBlade },
    { ViewerImageBlade },
    { ViewerNupkgBlade },
  ] = await Promise.all([
    import("../../blades/viewer-markdown/ViewerMarkdownBlade"),
    import("../../blades/viewer-code/ViewerCodeBlade"),
    import("../../blades/viewer-3d/Viewer3dBlade"),
    import("../../blades/viewer-image/ViewerImageBlade"),
    import("../../blades/viewer-nupkg/ViewerNupkgBlade"),
  ]);

  // Register blades (auto-namespaced to ext:content-viewers:*)
  api.registerBlade({ type: "viewer-markdown", title: "Markdown", component: ViewerMarkdownBlade, lazy: false });
  api.registerBlade({ type: "viewer-code", title: "Code", component: ViewerCodeBlade, lazy: false });
  api.registerBlade({ type: "viewer-3d", title: "3D Model", component: Viewer3dBlade, lazy: false });
  api.registerBlade({ type: "viewer-image", title: "Image", component: ViewerImageBlade, lazy: false });
  api.registerBlade({ type: "viewer-nupkg", title: "Package", component: ViewerNupkgBlade, lazy: false });

  // Register file dispatch mappings (maps extensions to namespaced blade types)
  api.registerFileDispatch({ extensions: ["md", "mdx"], bladeType: "viewer-markdown" });
  api.registerFileDispatch({ extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"], bladeType: "viewer-image" });
  api.registerFileDispatch({ extensions: ["glb", "gltf"], bladeType: "viewer-3d" });
  api.registerFileDispatch({ extensions: ["nupkg"], bladeType: "viewer-nupkg" });
  // Note: viewer-code is the extension fallback for browse, handled differently

  // Register preview handlers for staging context
  api.registerPreview({ key: "image", priority: 10, mode: "placeholder", ... });
  api.registerPreview({ key: "3d", priority: 10, mode: "placeholder", ... });
  api.registerPreview({ key: "archive", priority: 10, mode: "placeholder", ... });
}

export function onDeactivate(): void {
  // Cleanup is automatic via ExtensionAPI.cleanup()
  // File dispatch entries removed by unregisterFileDispatchBySource
  // Preview entries removed by unregisterPreviewBySource
}
```
**Source:** Pattern derived from `src/extensions/github/index.ts` (existing extension model)

### Example 3: Graceful Degradation in BladeRenderer

```typescript
// src/blades/_shared/BladeRenderer.tsx — Enhanced fallback
import { Puzzle } from "lucide-react";

export function BladeRenderer({ blade, goBack }: BladeRendererProps) {
  const reg = getBladeRegistration(blade.type);
  if (!reg) {
    // Determine if this was an extension blade that got unregistered
    const isExtensionBlade = blade.type.startsWith("ext:");
    return (
      <BladePanel title={blade.title} showBack onBack={goBack}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-ctp-overlay0">
          <Puzzle className="w-10 h-10 opacity-50" />
          <p className="text-sm">
            {isExtensionBlade
              ? "This content requires an extension that is currently disabled."
              : `Unknown blade type: ${blade.type}`}
          </p>
          {isExtensionBlade && (
            <button
              onClick={() => openBlade("extension-manager", {})}
              className="text-xs text-ctp-blue hover:underline"
            >
              Open Extension Manager
            </button>
          )}
        </div>
      </BladePanel>
    );
  }
  // ... rest unchanged
}
```

### Example 4: Plain Text Fallback Blade (Core)

```typescript
// src/blades/plain-text/PlainTextBlade.tsx — Always-available core fallback
import { FileText } from "lucide-react";
import { useRepoFile } from "../../hooks/useRepoFile";
import { BladeContentLoading } from "../_shared/BladeContentLoading";
import { BladeContentError } from "../_shared/BladeContentError";
import { BladeContentEmpty } from "../_shared/BladeContentEmpty";

interface PlainTextBladeProps {
  filePath: string;
}

export function PlainTextBlade({ filePath }: PlainTextBladeProps) {
  const { data, isLoading, error, refetch } = useRepoFile(filePath);

  if (isLoading) return <BladeContentLoading />;
  if (error) return <BladeContentError message="Failed to load file" detail={error.message} onRetry={() => refetch()} />;
  if (!data) return <BladeContentEmpty icon={FileText} message="File not found" detail={filePath} />;

  if (data.isBinary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-3">
        <FileText className="w-10 h-10 text-ctp-overlay0" />
        <p className="text-sm text-ctp-subtext0">Binary file -- preview not available</p>
        <p className="text-xs text-ctp-overlay0">{filePath}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto h-full bg-ctp-base">
      <pre className="p-4 text-xs text-ctp-text font-mono whitespace-pre-wrap break-words">
        {data.content}
      </pre>
    </div>
  );
}
```
**Source:** Derived from existing ViewerCodeBlade pattern but without Monaco dependency

## Detailed UX Analysis

### 1. Current UX Flow: File Preview Journeys

#### Journey A: Opening a .md file from Repo Browser
1. User navigates to a .md file in RepoBrowserBlade
2. Clicks the file row
3. `openFile()` calls `bladeTypeForFile(path, "browse")` -> returns "viewer-markdown"
4. `pushBlade({ type: "viewer-markdown", ... })` sends PUSH_BLADE to XState machine
5. BladeContainer animates new blade in via framer-motion
6. BladeRenderer finds "viewer-markdown" registration, renders `<ViewerMarkdownBlade>`
7. ViewerMarkdownBlade uses `useRepoFile` hook to fetch content, then renders `<MarkdownRenderer>`

#### Journey B: Opening a source file from Repo Browser
1. Same as above but `bladeTypeForFile(path, "browse")` returns "viewer-code" (fallback for unknown extensions)
2. ViewerCodeBlade renders with Monaco Editor in read-only mode

#### Journey C: Opening a .glb file from Repo Browser
1. Same as above but `bladeTypeForFile(path, "browse")` returns "viewer-3d"
2. Viewer3dBlade initializes Three.js scene, loads GLB model, renders interactive 3D viewport

#### Journey D: Viewing file diff in Staging context
1. User clicks a changed .md file in StagingChangesBlade
2. `openStagingDiff()` routes .md files to the diff blade (NOT viewer-markdown)
3. Inline preview via `StagingDiffPreview` uses `getPreviewForFile()` from previewRegistry
4. For images/3D/archives: shows placeholder with "click to expand" message
5. For text: shows inline diff view

### 2. Graceful Degradation UX Design

#### When Content-Viewers Extension is Disabled:

**Repo Browser (Browse Context):**
- Clicking any file should open a **plain text fallback blade** showing raw file content in a monospaced `<pre>` element
- Binary files (images, 3D models) should show the binary placeholder: "Binary file -- preview not available"
- The plain-text blade is a **core blade** (always registered, never extracted) so it's always available
- No error messages, no red text -- just a clean, functional degraded experience

**Staging Area (Diff Context):**
- Inline diff previews for text files should continue to work (the diff system is core, not extension-contributed)
- For image/3D/archive files: the preview should show a generic "Non-text file" placeholder (not the extension-specific "Image file -- click to expand")
- Expanding (clicking through) should route to the plain-text blade, which will show the binary placeholder

**Already-Open Viewer Blades:**
- If a user has viewer-markdown open and disables the extension, the blade should NOT crash
- BladeRenderer should show a graceful fallback: informational message + link to Extension Manager
- The blade should NOT auto-close (user might re-enable the extension)
- If the user navigates back, the stale blade is removed naturally from the stack

**Extension Manager Communication:**
- When disabling content-viewers, the toggle toast should say "Content Viewers disabled -- file previews will use plain text"
- No blocking confirmation dialog needed (low-impact change, easily reversible)
- The ExtensionCard already shows "Built-in" badge, name, version, and toggle -- no additional UI needed

### 3. File Dispatch Transformation

#### Current State (Static)
```
fileDispatch.ts:
  FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType>  // 15 entries, immutable
  bladeTypeForFile() reads from this map + returns fallbacks
```

#### Target State (Extensible)
```
fileDispatch.ts:
  CORE_DISPATCH: ReadonlyMap<string, string>          // Empty or minimal (binary markers only)
  extensionDispatch: Map<string, { bladeType, source }>  // Populated by extensions
  registerFileDispatch(exts, bladeType, source)
  unregisterFileDispatchBySource(source)
  bladeTypeForFile() reads extension overlay first, then core, then fallback
```

#### ExtensionAPI Addition
```
ExtensionAPI.registerFileDispatch(config: { extensions: string[], bladeType: string }):
  -> Namespaces bladeType to ext:{extensionId}:{bladeType}
  -> Calls registerFileDispatch() with source tracking
  -> Tracked for cleanup
```

### 4. Transition Experience Design

#### Extension Enable Transition (disabled -> active):
1. User toggles ON in Extension Manager
2. `activateExtension()` calls `onActivate(api)` on content-viewers extension
3. Extension registers blades and file dispatch entries synchronously
4. Toast: "Content Viewers enabled"
5. Already-open plain-text blades for .md files are NOT auto-replaced (that would be jarring)
6. User can navigate back and re-open the file to get the rich viewer
7. New file opens from this point forward use the rich viewers

#### Extension Disable Transition (active -> disabled):
1. User toggles OFF in Extension Manager
2. `deactivateExtension()` calls `onDeactivate()` then `api.cleanup()`
3. Extension blade registrations are removed from bladeRegistry
4. Extension file dispatch entries are removed from fileDispatch overlay
5. Extension preview registrations are removed from previewRegistry
6. Toast: "Content Viewers disabled"
7. Already-open viewer blades show graceful fallback message in BladeRenderer
8. New file opens from this point forward use plain-text fallback

### 5. Extensibility for Future Viewers

The design should support third-party extensions adding custom viewers. Key patterns:

#### File Dispatch Priority
The extension overlay should support priority so that:
- A third-party "Advanced PDF Viewer" extension can register `.pdf` -> `ext:pdf-viewer:viewer`
- If both the PDF viewer and a generic binary viewer match, the higher priority wins
- Core fallback always has the lowest priority

#### Recommended ExtensionAPI Surface
```typescript
api.registerFileDispatch({
  extensions: ["pdf"],
  bladeType: "viewer",           // Auto-namespaced to ext:pdf-viewer:viewer
  priority?: number,              // Default 0; higher wins
});

api.registerPreview({
  key: "pdf",
  extensions: string[],           // For extension-based matching
  mode: "placeholder" | "custom",
  placeholder?: { icon, message },
  component?: ComponentType,
  priority?: number,
});
```

#### Future "Open With..." Context Menu
The architecture naturally supports context menu contributions:
```typescript
api.contributeContextMenu({
  id: "open-with-viewer",
  label: "Open with PDF Viewer",
  location: "file-tree",
  when: (ctx) => ctx.filePath?.endsWith(".pdf"),
  execute: (ctx) => openBlade("ext:pdf-viewer:viewer", { filePath: ctx.filePath }),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static FILE_DISPATCH_MAP | Extension overlay + core fallback | Phase 38 | File type routing becomes extensible |
| Core blade registrations via _discovery.ts | Extension-contributed viewer blades | Phase 38 | Viewers are optional, toggleable |
| Hardcoded preview registrations | Extension-contributed preview handlers | Phase 38 | Staging previews respect extension lifecycle |
| "Unknown blade" red error text | Graceful fallback with Extension Manager link | Phase 38 | Clean UX when extension is disabled |
| No plain-text fallback blade | Core "plain-text" blade always available | Phase 38 | Files are always viewable regardless of extensions |

## Open Questions

1. **Should viewer-code remain partially in core?**
   - What we know: viewer-code serves as both a specialized viewer and the browse-context fallback. It depends on Monaco (large dependency).
   - What's unclear: Should the fallback be plain-text (no Monaco) or should viewer-code be split into core (plain-text) + extension (Monaco-enhanced)?
   - Recommendation: Create a lightweight plain-text core blade. Extract viewer-code entirely to the extension. This keeps the core small and dependency-free.

2. **Should the content-viewers extension be one extension or multiple?**
   - What we know: The roadmap says "a single toggleable built-in extension". The v1.6.0 summary says one extension.
   - What's unclear: Should image viewer be independent from 3D viewer? A user might want images but not Three.js.
   - Recommendation: Follow the roadmap -- one extension. This is the simplest approach and matches the success criteria. Splitting can be a future enhancement.

3. **What happens to the viewer-image blade for commit-context diffs?**
   - What we know: `useBladeNavigation.openDiff()` has special handling for "viewer-image" to pass `oid` prop. After extraction, the blade type becomes `ext:content-viewers:viewer-image`.
   - What's unclear: How does `openDiff()` know to pass `oid` to the extension-namespaced type?
   - Recommendation: `openDiff()` should use `bladeTypeForFile()` and pass standard props. The image viewer blade can receive `oid` as an optional prop regardless of namespacing.

4. **Should fileDispatch.ts move to a Zustand store?**
   - What we know: Other registries (toolbar, context menu, sidebar, status bar) are Zustand stores with `registrationTick` for reactivity.
   - What's unclear: Does anything subscribe to fileDispatch reactively? Currently it's called imperatively.
   - Recommendation: A Zustand store is overkill since fileDispatch is called imperatively, not subscribed to. A simple module-level Map with `registerFileDispatch`/`unregisterFileDispatchBySource` functions is sufficient. But `previewRegistry` DOES need a reactive tick because `StagingDiffPreview` renders based on it.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/fileDispatch.ts` — current static file dispatch implementation
- Codebase analysis: `src/lib/bladeRegistry.ts` — blade registration with source tracking
- Codebase analysis: `src/extensions/ExtensionAPI.ts` — per-extension API with automatic cleanup
- Codebase analysis: `src/extensions/ExtensionHost.ts` — built-in extension registration
- Codebase analysis: `src/blades/repo-browser/RepoBrowserBlade.tsx` — file opening UX flow
- Codebase analysis: `src/hooks/useBladeNavigation.ts` — blade navigation with file dispatch
- Codebase analysis: `src/blades/staging-changes/components/StagingDiffPreview.tsx` — inline preview rendering
- Codebase analysis: `src/blades/staging-changes/components/previewRegistrations.ts` — preview registration side-effects
- Codebase analysis: `src/blades/_shared/BladeRenderer.tsx` — blade rendering with fallback

### Secondary (MEDIUM confidence)
- `.planning/phases/37-extension-platform-foundation/37-ARCHITECTURE-RESEARCH.md:735-772` — fileDispatch refactoring design
- `.planning/research/v1.6.0-ARCHITECTURE.md:236-278` — ViewerContributionAPI design
- `.planning/research/v1.6.0-PITFALLS.md:202-220` — Pitfall 9: Preview registry cascade break
- `.planning/research/v1.6.0-SUMMARY.md:121-133` — Content viewer extraction rationale

### Tertiary (LOW confidence)
- None — all findings are from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Current UX flows: HIGH — direct code analysis of actual user journeys
- Graceful degradation design: HIGH — based on existing extension toggle patterns and BladeRenderer code
- File dispatch extensibility: HIGH — pattern already designed in Phase 37 architecture research, just not implemented
- Preview registry reactivity: HIGH — proven pattern from toolbarRegistry.visibilityTick
- Future extensibility: MEDIUM — extrapolated from current patterns, not yet validated

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (stable internal architecture)
