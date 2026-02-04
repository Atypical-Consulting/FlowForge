---
phase: quick-012
plan: 012
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/viewers/index.ts
  - src/components/viewers/ViewerRegistry.ts
  - src/components/viewers/DiffViewer.tsx
  - src/components/viewers/NugetPackageViewer.tsx
  - src/components/viewers/FileViewer.tsx
  - src/components/RepositoryView.tsx
autonomous: true

must_haves:
  truths:
    - "Selecting a .nupkg file shows NuGet package information instead of diff"
    - "NuGet viewer displays package name, version, authors, description, and download count from NuGet.org"
    - "Non-nupkg files continue to show the diff viewer as before"
    - "Adding new viewer types requires only creating a new viewer component and registering it"
  artifacts:
    - path: "src/components/viewers/ViewerRegistry.ts"
      provides: "Registry pattern for file type to viewer mapping"
      exports: ["ViewerRegistry", "registerViewer", "getViewerForFile"]
    - path: "src/components/viewers/NugetPackageViewer.tsx"
      provides: "NuGet package info viewer component"
      exports: ["NugetPackageViewer"]
    - path: "src/components/viewers/FileViewer.tsx"
      provides: "Main FileViewer component that delegates to appropriate viewer"
      exports: ["FileViewer"]
  key_links:
    - from: "src/components/viewers/FileViewer.tsx"
      to: "src/components/viewers/ViewerRegistry.ts"
      via: "getViewerForFile function call"
      pattern: "getViewerForFile"
    - from: "src/components/viewers/NugetPackageViewer.tsx"
      to: "https://api.nuget.org"
      via: "fetch to NuGet.org registration API"
      pattern: "api\\.nuget\\.org"
---

<objective>
Create a modular file viewer system that displays appropriate viewers based on file type, with a NuGet package viewer as the first specialized viewer.

Purpose: When users select a .nupkg file in the changes tab, show useful information from NuGet.org (package name, version, authors, description, downloads) instead of a useless binary diff message. The system should be extensible for future viewer types (images, markdown preview, etc.).
Output: A registry-based viewer system with DiffViewer as default and NugetPackageViewer for .nupkg files.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/diff/DiffViewer.tsx
@src/components/RepositoryView.tsx
@src/stores/staging.ts
@src/bindings.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create viewer registry and move DiffViewer</name>
  <files>src/components/viewers/ViewerRegistry.ts, src/components/viewers/DiffViewer.tsx, src/components/viewers/index.ts</files>
  <action>
Create a modular viewer system with a registry pattern:

**1. ViewerRegistry.ts - Registry for file type viewers:**
```typescript
import { FileChange } from "../../bindings";
import { ComponentType } from "react";

export interface ViewerProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked" | null;
}

type ViewerMatcher = (file: FileChange) => boolean;

interface RegisteredViewer {
  matcher: ViewerMatcher;
  component: ComponentType<ViewerProps>;
  priority: number; // Higher priority checked first
}

const viewers: RegisteredViewer[] = [];

export function registerViewer(
  matcher: ViewerMatcher,
  component: ComponentType<ViewerProps>,
  priority: number = 0
) {
  viewers.push({ matcher, component, priority });
  viewers.sort((a, b) => b.priority - a.priority);
}

export function getViewerForFile(file: FileChange): ComponentType<ViewerProps> | null {
  for (const viewer of viewers) {
    if (viewer.matcher(file)) {
      return viewer.component;
    }
  }
  return null;
}
```

**2. Move DiffViewer to src/components/viewers/DiffViewer.tsx:**
- Copy the existing src/components/diff/DiffViewer.tsx content
- Modify it to accept ViewerProps interface instead of reading from store directly
- The component should receive `file` and `section` as props
- Keep the Monaco DiffEditor, theme, and all existing functionality
- Export as named export: `export function DiffViewer({ file, section }: ViewerProps)`

**3. Create index.ts barrel export:**
```typescript
export { DiffViewer } from "./DiffViewer";
export { getViewerForFile, registerViewer, type ViewerProps } from "./ViewerRegistry";
```

**Do NOT:**
- Delete the original src/components/diff/DiffViewer.tsx yet (Task 3 handles cleanup)
- Register any viewers yet (Task 3 handles registration)
- Change the visual appearance of DiffViewer
  </action>
  <verify>
  - File exists at src/components/viewers/ViewerRegistry.ts
  - File exists at src/components/viewers/DiffViewer.tsx
  - File exists at src/components/viewers/index.ts
  - `npm run build` succeeds with no TypeScript errors
  </verify>
  <done>Viewer registry pattern is established with DiffViewer migrated to new location accepting props</done>
</task>

<task type="auto">
  <name>Task 2: Create NuGet package viewer</name>
  <files>src/components/viewers/NugetPackageViewer.tsx</files>
  <action>
Create a viewer that fetches and displays NuGet package information:

**NugetPackageViewer.tsx:**
```typescript
import { useQuery } from "@tanstack/react-query";
import { Package, Download, User, Calendar, ExternalLink, Loader2 } from "lucide-react";
import type { ViewerProps } from "./ViewerRegistry";

interface NugetPackageInfo {
  id: string;
  version: string;
  description: string;
  authors: string;
  totalDownloads: number;
  published: string;
  projectUrl?: string;
  licenseUrl?: string;
  tags: string[];
}

// Extract package ID and version from filename: PackageName.1.2.3.nupkg
function parseNupkgFilename(path: string): { id: string; version: string } | null {
  const filename = path.split("/").pop() || "";
  const match = filename.match(/^(.+?)\.(\d+\.\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.-]+)?)\.nupkg$/);
  if (!match) return null;
  return { id: match[1], version: match[2] };
}

async function fetchNugetInfo(packageId: string): Promise<NugetPackageInfo | null> {
  const lowerId = packageId.toLowerCase();
  const registrationUrl = `https://api.nuget.org/v3/registration5-gz-semver2/${lowerId}/index.json`;
  
  const response = await fetch(registrationUrl);
  if (!response.ok) return null;
  
  const data = await response.json();
  const items = data.items?.[0]?.items || data.items || [];
  const latestEntry = items[items.length - 1];
  const catalogEntry = latestEntry?.catalogEntry;
  
  if (!catalogEntry) return null;
  
  return {
    id: catalogEntry.id || packageId,
    version: catalogEntry.version,
    description: catalogEntry.description || "No description available",
    authors: catalogEntry.authors || "Unknown",
    totalDownloads: data.totalDownloads || 0,
    published: catalogEntry.published,
    projectUrl: catalogEntry.projectUrl,
    licenseUrl: catalogEntry.licenseUrl,
    tags: catalogEntry.tags || [],
  };
}

export function NugetPackageViewer({ file }: ViewerProps) {
  const parsed = parseNupkgFilename(file.path);
  
  const { data: packageInfo, isLoading, error } = useQuery({
    queryKey: ["nuget-package", parsed?.id],
    queryFn: () => parsed ? fetchNugetInfo(parsed.id) : null,
    enabled: !!parsed,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (!parsed) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-sm">Invalid NuGet package filename</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-950">
        <Package className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-gray-300 truncate flex-1">{file.path}</span>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
        <div className="max-w-2xl space-y-4">
          {/* Package Title */}
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              {parsed.id}
              <span className="text-sm font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                v{parsed.version}
              </span>
            </h2>
            {packageInfo?.description && (
              <p className="text-gray-400 mt-2">{packageInfo.description}</p>
            )}
          </div>
          
          {/* Stats Grid */}
          {packageInfo && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Download className="w-3 h-3" />
                  Total Downloads
                </div>
                <div className="text-white font-medium">
                  {packageInfo.totalDownloads.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <User className="w-3 h-3" />
                  Authors
                </div>
                <div className="text-white font-medium truncate">
                  {packageInfo.authors}
                </div>
              </div>
              
              {packageInfo.published && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Calendar className="w-3 h-3" />
                    Published
                  </div>
                  <div className="text-white font-medium">
                    {new Date(packageInfo.published).toLocaleDateString()}
                  </div>
                </div>
              )}
              
              {packageInfo.projectUrl && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <ExternalLink className="w-3 h-3" />
                    Project
                  </div>
                  <a 
                    href={packageInfo.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm truncate block"
                  >
                    View on NuGet.org
                  </a>
                </div>
              )}
            </div>
          )}
          
          {/* Tags */}
          {packageInfo?.tags && packageInfo.tags.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-2">Tags</div>
              <div className="flex flex-wrap gap-2">
                {packageInfo.tags.slice(0, 10).map((tag) => (
                  <span key={tag} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Error/Not Found State */}
          {error && (
            <div className="text-yellow-400 text-sm">
              Could not fetch package info from NuGet.org
            </div>
          )}
          
          {!isLoading && !packageInfo && !error && (
            <div className="text-gray-400 text-sm">
              Package not found on NuGet.org. This may be a private or local package.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Add to index.ts:
```typescript
export { NugetPackageViewer } from "./NugetPackageViewer";
```

**Do NOT:**
- Use any external fetch library (native fetch is fine)
- Add error boundaries (simple error state in component is sufficient)
- Parse .nuspec files from the package (use NuGet.org API only)
  </action>
  <verify>
  - File exists at src/components/viewers/NugetPackageViewer.tsx
  - Export added to src/components/viewers/index.ts
  - `npm run build` succeeds with no TypeScript errors
  </verify>
  <done>NugetPackageViewer fetches and displays package info from NuGet.org API</done>
</task>

<task type="auto">
  <name>Task 3: Create FileViewer wrapper and integrate into RepositoryView</name>
  <files>src/components/viewers/FileViewer.tsx, src/components/viewers/index.ts, src/components/RepositoryView.tsx</files>
  <action>
Create the main FileViewer component that delegates to appropriate viewers and integrate it:

**1. FileViewer.tsx - Main entry point:**
```typescript
import { useStagingStore } from "../../stores/staging";
import { getViewerForFile, registerViewer } from "./ViewerRegistry";
import { DiffViewer } from "./DiffViewer";
import { NugetPackageViewer } from "./NugetPackageViewer";

// Register viewers on module load
// NuGet viewer: matches .nupkg files with high priority
registerViewer(
  (file) => file.path.toLowerCase().endsWith(".nupkg"),
  NugetPackageViewer,
  100
);

// Default diff viewer: matches all files as fallback (priority 0)
registerViewer(
  () => true,
  DiffViewer,
  0
);

export function FileViewer() {
  const { selectedFile, selectedSection } = useStagingStore();

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-500 text-sm">Select a file to view</p>
      </div>
    );
  }

  const Viewer = getViewerForFile(selectedFile);
  
  if (!Viewer) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-500 text-sm">No viewer available for this file type</p>
      </div>
    );
  }

  return <Viewer file={selectedFile} section={selectedSection} />;
}
```

**2. Update index.ts:**
```typescript
export { DiffViewer } from "./DiffViewer";
export { NugetPackageViewer } from "./NugetPackageViewer";
export { FileViewer } from "./FileViewer";
export { getViewerForFile, registerViewer, type ViewerProps } from "./ViewerRegistry";
```

**3. Update RepositoryView.tsx:**
- Change import from `import { DiffViewer } from "./diff/DiffViewer"` to `import { FileViewer } from "./viewers"`
- Replace `<DiffViewer />` with `<FileViewer />` in the changes tab right panel

**4. Cleanup:**
- Delete src/components/diff/DiffViewer.tsx (now lives in viewers/)
- Delete src/components/diff/ directory if empty

**Do NOT:**
- Change any other imports or usages of DiffViewer
- Modify the layout or positioning of the viewer in RepositoryView
- Add any additional viewers beyond NuGet and Diff
  </action>
  <verify>
  - File exists at src/components/viewers/FileViewer.tsx
  - src/components/RepositoryView.tsx imports FileViewer from "./viewers"
  - src/components/diff/ directory is removed
  - `npm run build` succeeds
  - `npm run dev` shows:
    - Normal files display diff as before
    - Selecting a .nupkg file shows NuGet package info panel
  </verify>
  <done>Modular viewer system is integrated, DiffViewer is default, NugetPackageViewer handles .nupkg files</done>
</task>

</tasks>

<verification>
1. Run `npm run build` - must pass with no errors
2. Run `npm run dev` and test:
   - Select a normal file (e.g., .ts, .json) - should show diff viewer as before
   - If you have a .nupkg file in changes, select it - should show NuGet info
3. Verify extensibility: adding a new viewer would only require:
   - Create new viewer component implementing ViewerProps
   - Call registerViewer() with a matcher function
</verification>

<success_criteria>
- Modular viewer registry exists with priority-based matching
- DiffViewer moved to viewers/ folder and works as default
- NugetPackageViewer displays package info from NuGet.org API
- FileViewer delegates to correct viewer based on file extension
- Build passes with no errors
- Existing diff functionality unchanged for non-nupkg files
</success_criteria>

<output>
After completion, create `.planning/quick/012-nupkg-file-viewer-with-nuget-org-info/012-SUMMARY.md`
</output>
