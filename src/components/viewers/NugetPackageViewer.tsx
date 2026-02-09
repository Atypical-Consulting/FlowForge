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
import { commands } from "../../bindings";
import type { ViewerProps } from "./ViewerRegistry";

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

export function NugetPackageViewer({ file }: ViewerProps) {
  const parsed = parseNupkgFilename(file.path);

  const {
    data: packageInfo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["nuget-package", parsed?.id],
    queryFn: async () => {
      if (!parsed) return null;
      const result = await commands.fetchNugetInfo(parsed.id);
      if (result.status === "error") throw new Error(result.error.type);
      return result.data;
    },
    enabled: !!parsed,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (!parsed) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay1 text-sm">
          Invalid NuGet package filename
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust">
        <Package className="w-4 h-4 text-ctp-mauve" />
        <span className="text-sm text-ctp-subtext1 truncate flex-1">
          {file.path}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-ctp-mantle">
        <div className="max-w-2xl space-y-4">
          {/* Package Title */}
          <div>
            <h2 className="text-xl font-semibold text-ctp-text flex items-center gap-2">
              {parsed.id}
              <span className="text-sm font-normal text-ctp-overlay1 bg-ctp-surface0 px-2 py-0.5 rounded">
                v{parsed.version}
              </span>
            </h2>
            {packageInfo?.description && (
              <p className="text-ctp-overlay1 mt-2">
                {packageInfo.description}
              </p>
            )}
          </div>

          {/* Stats Grid */}
          {packageInfo && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-ctp-surface0 rounded-lg p-3">
                <div className="flex items-center gap-2 text-ctp-overlay1 text-xs mb-1">
                  <Download className="w-3 h-3" />
                  Total Downloads
                </div>
                <div className="text-ctp-text font-medium">
                  {packageInfo.totalDownloads.toLocaleString()}
                </div>
              </div>

              <div className="bg-ctp-surface0 rounded-lg p-3">
                <div className="flex items-center gap-2 text-ctp-overlay1 text-xs mb-1">
                  <User className="w-3 h-3" />
                  Authors
                </div>
                <div className="text-ctp-text font-medium truncate">
                  {packageInfo.authors}
                </div>
              </div>

              {packageInfo.published && (
                <div className="bg-ctp-surface0 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-ctp-overlay1 text-xs mb-1">
                    <Calendar className="w-3 h-3" />
                    Published
                  </div>
                  <div className="text-ctp-text font-medium">
                    {new Date(packageInfo.published).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* NuGet.org Link - always available */}
              <div className="bg-ctp-surface0 rounded-lg p-3">
                <div className="flex items-center gap-2 text-ctp-overlay1 text-xs mb-1">
                  <ExternalLink className="w-3 h-3" />
                  NuGet.org
                </div>
                <a
                  href={packageInfo.nugetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ctp-blue hover:underline text-sm truncate block"
                >
                  View on NuGet.org
                </a>
              </div>

              {/* Project URL (GitHub etc) - optional */}
              {packageInfo.projectUrl && (
                <div className="bg-ctp-surface0 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-ctp-overlay1 text-xs mb-1">
                    <Github className="w-3 h-3" />
                    Project
                  </div>
                  <a
                    href={packageInfo.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ctp-blue hover:underline text-sm truncate block"
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
              <div className="text-ctp-overlay1 text-xs mb-2">Tags</div>
              <div className="flex flex-wrap gap-2">
                {packageInfo.tags.slice(0, 10).map((tag) => (
                  <span
                    key={tag}
                    className="bg-ctp-surface0 text-ctp-subtext1 px-2 py-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error/Not Found State */}
          {error && (
            <div className="text-ctp-yellow text-sm">
              Could not fetch package info from NuGet.org
            </div>
          )}

          {!isLoading && !packageInfo && !error && (
            <div className="text-ctp-overlay1 text-sm">
              Package not found on NuGet.org. This may be a private or local
              package.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
