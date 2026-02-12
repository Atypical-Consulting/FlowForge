import { AlertTriangle, CheckCircle, GitMerge } from "lucide-react";
import type { ConflictFile } from "../../types";

interface ConflictFileListProps {
  files: Map<string, ConflictFile>;
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  onMarkResolved: (path: string) => void;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function getDirectory(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

export function ConflictFileList({
  files,
  activeFilePath,
  onSelectFile,
  onMarkResolved,
}: ConflictFileListProps) {
  const entries = Array.from(files.entries());

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-ctp-subtext0">
        <GitMerge className="w-8 h-8 text-ctp-overlay0" />
        <p className="text-sm">No merge conflicts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      <div className="px-3 py-2 text-xs font-semibold text-ctp-subtext0 uppercase tracking-wide border-b border-ctp-surface0">
        Conflicts ({entries.length})
      </div>
      {entries.map(([path, file]) => {
        const isActive = path === activeFilePath;
        const resolvedCount = file.hunks.filter(
          (h) => h.resolution !== null,
        ).length;
        const totalCount = file.hunks.length;

        return (
          <button
            key={path}
            onClick={() => onSelectFile(path)}
            className={`w-full text-left px-3 py-2 border-b border-ctp-surface0/50 transition-colors hover:bg-ctp-surface0/50 ${
              isActive ? "bg-ctp-surface0" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              {file.status === "unresolved" && (
                <AlertTriangle className="w-3.5 h-3.5 text-ctp-red shrink-0" />
              )}
              {file.status === "partially-resolved" && (
                <AlertTriangle className="w-3.5 h-3.5 text-ctp-yellow shrink-0" />
              )}
              {file.status === "resolved" && (
                <CheckCircle className="w-3.5 h-3.5 text-ctp-green shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ctp-text truncate">
                  {getFileName(path)}
                </div>
                {getDirectory(path) && (
                  <div className="text-xs text-ctp-overlay0 truncate">
                    {getDirectory(path)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-ctp-overlay0">
                {resolvedCount}/{totalCount} resolved
              </span>
              {file.status === "resolved" && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkResolved(path);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onMarkResolved(path);
                    }
                  }}
                  className="px-2 py-0.5 text-xs rounded bg-ctp-green text-ctp-base font-medium hover:bg-ctp-green/80 transition-colors"
                >
                  Mark Resolved
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
