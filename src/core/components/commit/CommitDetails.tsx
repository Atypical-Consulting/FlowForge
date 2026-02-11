import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Loader2, User } from "lucide-react";
import { type CommitSummary, commands } from "../../bindings";
import { cn } from "../../lib/utils";

interface CommitDetailsProps {
  commit: CommitSummary;
}

export function CommitDetails({ commit }: CommitDetailsProps) {
  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["commitDetails", commit.oid],
    queryFn: () => commands.getCommitDetails(commit.oid),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  if (error || !result || result.status === "error") {
    return (
      <div className="flex items-center justify-center h-full text-ctp-red text-sm">
        Failed to load commit details
      </div>
    );
  }

  const details = result.data;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <p className="font-mono text-sm text-ctp-blue">{details.shortOid}</p>
        <h3 className="text-lg text-ctp-text mt-1 whitespace-pre-wrap">
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

      {/* Files changed */}
      <div>
        <div className="flex items-center gap-2 text-sm text-ctp-subtext1 mb-2">
          <FileText className="w-4 h-4" />
          <span>{details.filesChanged.length} files changed</span>
        </div>
        <div className="space-y-1">
          {details.filesChanged.map((file) => (
            <div
              key={file.path}
              className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-ctp-surface0/50"
            >
              <span
                className={cn(
                  "w-4 text-center text-xs",
                  file.status === "added" && "text-ctp-green",
                  file.status === "deleted" && "text-ctp-red",
                  file.status === "modified" && "text-ctp-yellow",
                )}
              >
                {file.status === "added"
                  ? "A"
                  : file.status === "deleted"
                    ? "D"
                    : "M"}
              </span>
              <span className="text-ctp-subtext1 truncate flex-1">
                {file.path}
              </span>
              <span className="text-xs">
                <span className="text-ctp-green">+{file.additions}</span>{" "}
                <span className="text-ctp-red">-{file.deletions}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Parent commits */}
      {details.parentOids.length > 0 && (
        <div className="text-sm text-ctp-overlay0">
          <span>Parents: </span>
          {details.parentOids.map((oid, i) => (
            <span key={oid} className="font-mono">
              {i > 0 && ", "}
              {oid.slice(0, 7)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
