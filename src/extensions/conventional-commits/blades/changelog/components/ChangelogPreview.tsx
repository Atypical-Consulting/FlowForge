import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { ConventionalCommitType } from "../../../lib/commit-type-theme";
import { cn } from "../../../../../lib/utils";
import type { ChangelogOutput } from "../store";
import { CommitTypeIcon } from "../../../../../components/icons/CommitTypeIcon";

interface ChangelogPreviewProps {
  changelog: ChangelogOutput;
}

export function ChangelogPreview({ changelog }: ChangelogPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(changelog.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-ctp-overlay1">
        <span>{changelog.commitCount} commits</span>
        <span>{changelog.groups.length} groups</span>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm border rounded",
          "transition-colors",
          copied
            ? "border-ctp-green/30 text-ctp-green bg-ctp-green/10"
            : "border-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface0",
        )}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy to clipboard
          </>
        )}
      </button>

      {/* Markdown preview */}
      <div className="p-4 bg-ctp-crust border border-ctp-surface1 rounded max-h-75 overflow-y-auto">
        <pre className="text-sm font-mono whitespace-pre-wrap text-ctp-subtext1">
          {changelog.markdown}
        </pre>
      </div>

      {/* Group breakdown */}
      {changelog.groups.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-ctp-subtext1">Breakdown</h4>
          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {changelog.groups.map((group) => (
              <div
                key={group.commitType}
                className="flex items-center gap-2 p-2 bg-ctp-surface0/50 rounded"
                title={`${group.commits.length} ${group.commitType} commit${group.commits.length !== 1 ? "s" : ""}`}
              >
                <CommitTypeIcon
                  commitType={group.commitType as ConventionalCommitType}
                  className="w-4 h-4 shrink-0"
                />
                <span className="flex-1 text-ctp-subtext1">{group.title}</span>
                <span className="text-ctp-overlay0">
                  {group.commits.length}
                </span>
              </div>
            ))}
          </div>
          {/* Detailed commit list per group */}
          <div className="space-y-2 text-sm">
            {changelog.groups.map((group) => (
              <div key={group.commitType}>
                <div className="flex items-center gap-1.5 text-ctp-subtext0 mb-1">
                  <CommitTypeIcon
                    commitType={group.commitType as ConventionalCommitType}
                    className="w-3.5 h-3.5"
                  />
                  <span className="font-medium">{group.title}</span>
                </div>
                <div className="pl-5 space-y-0.5">
                  {group.commits.map((commit) => (
                    <div
                      key={commit.hash}
                      className="flex items-start gap-1.5 text-ctp-overlay1"
                    >
                      <span className="text-ctp-overlay0 font-mono text-xs mt-0.5">
                        {commit.hash}
                      </span>
                      <span>
                        {commit.scope && (
                          <strong className="text-ctp-subtext1">
                            {commit.scope}:{" "}
                          </strong>
                        )}
                        {commit.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
