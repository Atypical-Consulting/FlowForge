import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Loader2, User, X } from "lucide-react";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";

interface TopologyCommitDetailsProps {
  oid: string;
  onClose: () => void;
}

export function TopologyCommitDetails({ oid, onClose }: TopologyCommitDetailsProps) {
  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["commitDetails", oid],
    queryFn: () => commands.getCommitDetails(oid),
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 border-l border-gray-800">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !result || result.status === "error") {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 border-l border-gray-800 text-red-400 text-sm">
        Failed to load commit details
      </div>
    );
  }

  const details = result.data;

  return (
    <div className="h-full overflow-y-auto bg-gray-900 border-l border-gray-800">
      {/* Header with close button */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-3 flex items-center justify-between">
        <span className="font-mono text-sm text-blue-400">{details.shortOid}</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Commit message */}
        <div>
          <h3 className="text-lg text-white whitespace-pre-wrap">{details.message}</h3>
        </div>

        {/* Author info */}
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <User className="w-4 h-4" />
            <span>
              {details.authorName} &lt;{details.authorEmail}&gt;
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{new Date(details.authorTimestampMs).toLocaleString()}</span>
          </div>
        </div>

        {/* Parent commits */}
        {details.parentOids.length > 0 && (
          <div className="text-sm">
            <span className="text-gray-500">
              {details.parentOids.length === 1 ? "Parent: " : "Parents: "}
            </span>
            <span className="font-mono text-gray-400">
              {details.parentOids.map((p) => p.substring(0, 7)).join(", ")}
            </span>
          </div>
        )}

        {/* Files changed */}
        {details.filesChanged.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Files Changed ({details.filesChanged.length})
            </h4>
            <div className="space-y-1">
              {details.filesChanged.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-gray-800/50"
                >
                  <span
                    className={cn(
                      "truncate",
                      file.status === "Added" && "text-green-400",
                      file.status === "Deleted" && "text-red-400",
                      file.status === "Modified" && "text-yellow-400"
                    )}
                  >
                    {file.path}
                  </span>
                  <span className="text-xs text-gray-500 ml-2 shrink-0">
                    <span className="text-green-400">+{file.additions}</span>
                    {" / "}
                    <span className="text-red-400">-{file.deletions}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
