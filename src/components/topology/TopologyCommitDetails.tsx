import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Loader2, User, X } from "lucide-react";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";

interface TopologyCommitDetailsProps {
  oid: string;
  onClose: () => void;
}

export function TopologyCommitDetails({
  oid,
  onClose,
}: TopologyCommitDetailsProps) {
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
      <div className="h-full flex items-center justify-center bg-ctp-mantle border-l border-ctp-surface0">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  if (error || !result || result.status === "error") {
    return (
      <div className="h-full flex items-center justify-center bg-ctp-mantle border-l border-ctp-surface0 text-ctp-red text-sm">
        Failed to load commit details
      </div>
    );
  }

  const details = result.data;

  return (
    <div className="h-full overflow-y-auto bg-ctp-mantle border-l border-ctp-surface0">
      {/* Header with close button */}
      <div className="sticky top-0 bg-ctp-mantle border-b border-ctp-surface0 p-3 flex items-center justify-between">
        <span className="font-mono text-sm text-ctp-blue">
          {details.shortOid}
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-ctp-surface0 rounded text-ctp-overlay1 hover:text-ctp-text"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Commit message */}
        <div>
          <h3 className="text-lg text-ctp-text whitespace-pre-wrap">
            {details.message}
          </h3>
        </div>

        {/* Author info */}
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-ctp-overlay1">
            <User className="w-4 h-4" />
            <span>
              {details.authorName} &lt;{details.authorEmail}&gt;
            </span>
          </div>
          <div className="flex items-center gap-2 text-ctp-overlay1">
            <Clock className="w-4 h-4" />
            <span>{new Date(details.authorTimestampMs).toLocaleString()}</span>
          </div>
        </div>

        {/* Parent commits */}
        {details.parentOids.length > 0 && (
          <div className="text-sm">
            <span className="text-ctp-overlay0">
              {details.parentOids.length === 1 ? "Parent: " : "Parents: "}
            </span>
            <span className="font-mono text-ctp-overlay1">
              {details.parentOids.map((p) => p.substring(0, 7)).join(", ")}
            </span>
          </div>
        )}

        {/* Files changed */}
        {details.filesChanged.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-ctp-subtext1 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Files Changed ({details.filesChanged.length})
            </h4>
            <div className="space-y-1">
              {details.filesChanged.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-ctp-surface0/50"
                >
                  <span
                    className={cn(
                      "truncate",
                      file.status === "Added" && "text-ctp-green",
                      file.status === "Deleted" && "text-ctp-red",
                      file.status === "Modified" && "text-ctp-yellow",
                    )}
                  >
                    {file.path}
                  </span>
                  <span className="text-xs text-ctp-overlay0 ml-2 shrink-0">
                    <span className="text-ctp-green">+{file.additions}</span>
                    {" / "}
                    <span className="text-ctp-red">-{file.deletions}</span>
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
