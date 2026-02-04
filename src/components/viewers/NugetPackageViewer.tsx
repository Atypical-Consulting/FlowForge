import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Download,
  User,
  Calendar,
  ExternalLink,
  Loader2,
} from "lucide-react";
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
function parseNupkgFilename(
  path: string
): { id: string; version: string } | null {
  const filename = path.split("/").pop() || "";
  const match = filename.match(
    /^(.+?)\.(\d+\.\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.-]+)?)\.nupkg$/
  );
  if (!match) return null;
  return { id: match[1], version: match[2] };
}

async function fetchNugetInfo(
  packageId: string
): Promise<NugetPackageInfo | null> {
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

  const {
    data: packageInfo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["nuget-package", parsed?.id],
    queryFn: () => (parsed ? fetchNugetInfo(parsed.id) : null),
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
        <span className="text-sm text-gray-300 truncate flex-1">
          {file.path}
        </span>
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
                  <span
                    key={tag}
                    className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs"
                  >
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
              Package not found on NuGet.org. This may be a private or local
              package.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
