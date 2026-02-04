import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Download,
  ExternalLink,
  Github,
  Loader2,
  Package,
  User,
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
  nugetUrl: string;
}

// Extract package ID and version from filename: PackageName.1.2.3.nupkg
function parseNupkgFilename(
  path: string,
): { id: string; version: string } | null {
  const filename = path.split("/").pop() || "";
  const match = filename.match(
    /^(.+?)\.(\d+\.\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.-]+)?)\.nupkg$/,
  );
  if (!match) return null;
  return { id: match[1], version: match[2] };
}

async function fetchNugetInfo(
  packageId: string,
): Promise<NugetPackageInfo | null> {
  // Use the search API which provides totalDownloads
  const searchUrl = `https://azuresearch-usnc.nuget.org/query?q=packageid:${encodeURIComponent(packageId)}&prerelease=true&take=1`;

  const response = await fetch(searchUrl);
  if (!response.ok) return null;

  const data = await response.json();
  const pkg = data.data?.[0];

  if (!pkg) return null;

  // Get the latest version's details from registration API for published date
  const lowerId = packageId.toLowerCase();
  const registrationUrl = `https://api.nuget.org/v3/registration5-gz-semver2/${lowerId}/index.json`;

  let published = "";
  try {
    const regResponse = await fetch(registrationUrl);
    if (regResponse.ok) {
      const regData = await regResponse.json();
      const items = regData.items?.[0]?.items || regData.items || [];
      const latestEntry = items[items.length - 1];
      published = latestEntry?.catalogEntry?.published || "";
    }
  } catch {
    // Ignore registration fetch errors, published date is optional
  }

  return {
    id: pkg.id || packageId,
    version: pkg.version,
    description: pkg.description || "No description available",
    authors: Array.isArray(pkg.authors)
      ? pkg.authors.join(", ")
      : pkg.authors || "Unknown",
    totalDownloads: pkg.totalDownloads || 0,
    published,
    projectUrl: pkg.projectUrl,
    licenseUrl: pkg.licenseUrl,
    tags: pkg.tags || [],
    nugetUrl: `https://www.nuget.org/packages/${pkg.id || packageId}`,
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

              {/* NuGet.org Link - always available */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <ExternalLink className="w-3 h-3" />
                  NuGet.org
                </div>
                <a
                  href={packageInfo.nugetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm truncate block"
                >
                  View on NuGet.org
                </a>
              </div>

              {/* Project URL (GitHub etc) - optional */}
              {packageInfo.projectUrl && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Github className="w-3 h-3" />
                    Project
                  </div>
                  <a
                    href={packageInfo.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm truncate block"
                  >
                    View Source
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
