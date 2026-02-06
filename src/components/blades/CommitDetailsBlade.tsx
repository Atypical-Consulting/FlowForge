import { useQuery } from "@tanstack/react-query";
import { Clock, Copy, GitCommit, Loader2, User } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { FileTreeBlade } from "./FileTreeBlade";

interface CommitDetailsBladeProps {
  oid: string;
}

export function CommitDetailsBlade({ oid }: CommitDetailsBladeProps) {
  const { openDiff } = useBladeNavigation();
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

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
  const [subject, ...bodyLines] = details.message.split("\n");
  const body = bodyLines.join("\n").trim();

  const handleCopySha = async () => {
    await navigator.clipboard.writeText(details.oid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectFile = (filePath: string) => {
    setSelectedFile(filePath);
    openDiff(oid, filePath);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Commit message */}
      <div>
        <h3 className="text-base font-medium text-ctp-text">{subject}</h3>
        {body && (
          <p className="text-sm text-ctp-subtext0 mt-2 whitespace-pre-wrap">
            {body}
          </p>
        )}
      </div>

      {/* Metadata card */}
      <div className="bg-ctp-surface0/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm text-ctp-subtext1">
          <User className="w-4 h-4 shrink-0" />
          <span>
            {details.authorName} &lt;{details.authorEmail}&gt;
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-ctp-subtext1">
          <Clock className="w-4 h-4 shrink-0" />
          <span>{new Date(details.authorTimestampMs).toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 shrink-0 text-ctp-overlay1" />
          <button
            onClick={handleCopySha}
            className="font-mono text-xs text-ctp-overlay1 hover:text-ctp-text transition-colors flex items-center gap-1"
            title="Copy full SHA"
          >
            {details.oid}
            <Copy className="w-3 h-3" />
          </button>
          {copied && (
            <span className="text-xs text-ctp-green">Copied!</span>
          )}
        </div>

        {details.parentOids.length > 0 && (
          <div className="text-sm text-ctp-overlay0">
            <span>
              {details.parentOids.length === 1 ? "Parent: " : "Parents: "}
            </span>
            <span className="font-mono text-xs">
              {details.parentOids.map((p) => p.substring(0, 7)).join(", ")}
            </span>
          </div>
        )}

        {details.committerName !== details.authorName && (
          <div className="flex items-center gap-2 text-sm text-ctp-overlay0">
            <User className="w-4 h-4 shrink-0" />
            <span>
              Committer: {details.committerName} &lt;{details.committerEmail}&gt;
            </span>
          </div>
        )}
      </div>

      {/* Files changed */}
      {details.filesChanged.length > 0 && (
        <FileTreeBlade
          files={details.filesChanged}
          onSelectFile={handleSelectFile}
          selectedFile={selectedFile}
        />
      )}
    </div>
  );
}
